const _ = require('lodash')

const QUEUE_TYPE = {
    FIELD: 'field',
    COLLECTION: 'collection',
    ARRAY: 'array',
}
const QUEUE_MEMBER = {
    VALIDATOR: 'validator',
    FILTER: 'filter',
}

class Validator {
    constructor () {
        this.queues = []
        this.states = {}
    }

    static get QUEUE_MEMBER () { return QUEUE_MEMBER }

    /**
     * Apply list of filters and validators to field
     * @param {string} name field name (use dots)
     * @param {[]} queue list of filters and validators
     */
    field (name, queue) {
        this.queues.push({
            type: QUEUE_TYPE.FIELD,
            name,
            queue: queue || [],
        })
    }

    /**
     * Apply list of filters and validators to each element of collection
     * @param {string} name field name (use dots)
     * @param {string} subname field name inside collection object (use dots)
     * @param {[]} queue list of filters and validators
     * @param {[]} queueAsField list of filters and validators used on collection field (runs first)
     */
    collection (name, subname, queue, queueAsField) {
        this.queues.push({
            type: QUEUE_TYPE.FIELD,
            name,
            queue: queueAsField || [],
        })
        this.queues.push({
            type: QUEUE_TYPE.COLLECTION,
            name,
            subname,
            queue: queue || [],
        })
    }

    /**
     * Apply list of filters and validators to each element of array
     * @param {string} name field name (use dots)
     * @param {[]} queue list of filters and validators
     * @param {[]} queueAsField list of filters and validators used on collection field (runs first)
     */
    array (name, queue, queueAsField) {
        this.queues.push({
            type: QUEUE_TYPE.FIELD,
            name,
            queue: queueAsField || [],
        })
        this.queues.push({
            type: QUEUE_TYPE.ARRAY,
            name,
            queue: queue || [],
        })
    }

    async validate (object) {
        // group validation to subgroups
        let named = _.values(_.groupBy(this.queues, queue => queue.name))
        let states = []
        const promises = _.mapValues(named, async (queues) => {
            // console.log(queues)
            const name = queues[0].name
            let state = {
                name,
                data: _.get(object, name),
                exists: _.has(object, name),
                errors: [],
            }
            states.push(state)
            queues = _.sortBy(queues, queue => queue.type === QUEUE_TYPE.FIELD ? -1 : 1)
            for (let queue of queues) {
                if (queue.type === QUEUE_TYPE.FIELD) {
                    for (let q of queue.queue) {
                        try {
                            let el = q(state)
                            if (el.type === QUEUE_MEMBER.FILTER) {
                                state.data = await el.result(state.data)
                            }
                            if (el.type === QUEUE_MEMBER.VALIDATOR) {
                                let d = await el.result(state.data)
                                if (!d) {
                                    throw new FieldError(el.name, state.name, 'invalid')
                                }
                            }
                        } catch (err) {
                            state.errors.push(err)
                        }
                    }
                }
                if (queue.type === QUEUE_TYPE.ARRAY) {
                    for (let q of queue.queue) {
                        try {
                            let el = q(state)
                            if (el.type === QUEUE_MEMBER.FILTER) {
                                _.forEach(state.data, async (elem, ind) => {
                                    try {
                                        state.data[ind] = await el.result(state.data[ind])
                                    } catch (err) {
                                        state.errors.push(err)
                                    }
                                })
                            }
                            if (el.type === QUEUE_MEMBER.VALIDATOR) {
                                _.forEach(state.data, async (elem, ind) => {
                                    try {
                                        let d = await el.result(state.data[ind])
                                        if (!d) {
                                            throw new FieldError(el.name, state.name, 'invalid')
                                        }
                                    } catch (err) {
                                        state.errors.push(err)
                                    }
                                })
                            }
                        } catch (err) {
                            state.errors.push(err)
                        }
                    }
                }
                if (queue.type === QUEUE_TYPE.COLLECTION) {
                    for (let q of queue.queue) {
                        try {
                            let el = q(state)
                            if (el.type === QUEUE_MEMBER.FILTER) {
                                _.forEach(state.data, async (elem, ind) => {
                                    try {
                                        let d = await el.result(_.get(state.data[ind], queue.subname))
                                        _.set(state.data[ind], queue.subname, d)
                                    } catch (err) {
                                        state.errors.push(err)
                                    }
                                })
                            }
                            if (el.type === QUEUE_MEMBER.VALIDATOR) {
                                _.forEach(state.data, async (elem, ind) => {
                                    try {
                                        let d = await el.result(_.get(state.data[ind], queue.subname))
                                        if (!d) {
                                            throw new FieldError(el.name, state.name + `[${ind}]` + queue.subname, 'invalid')
                                        }
                                    } catch (err) {
                                        state.errors.push(err)
                                    }
                                })
                            }
                        } catch (err) {
                            state.errors.push(err)
                        }
                    }
                }
            }
        })
        await Promise.all(_.filter(promises))

        if (_.some(states, state => state.errors.length > 0)) {
            let errors = _.map(states, state => ({
                name: state.name,
                errors: state.errors,
            }))
            errors = _.filter(errors, error => error.errors.length)
            throw new ValidationError('Validation failed', errors)
        }

        // build a cleared form
        const form = {}
        for (let state of states) {
            form[state.name] = state.data
        }

        return form
    }

    static filter (method, ...opts) {
        if (typeof method !== 'function') {
            return null
        }
        return (state) => {
            return {
                name: method.name || 'custom filter',
                type: QUEUE_MEMBER.FILTER,
                result: (data) => method.apply(null, [data, ...opts]),
            }
        }
    }

    static validator (method, ...opts) {
        if (typeof method !== 'function') {
            return null
        }
        return (state) => {
            return {
                name: method.name || 'custom validator',
                type: QUEUE_MEMBER.VALIDATOR,
                result: (data) => method.apply(null, [data, ...opts]),
            }
        }
    }

    // Custor validators
    static exists (state) {
        return {
            name: 'exists',
            type: QUEUE_MEMBER.VALIDATOR,
            result: () => state.exists ? true : new Error('field not exists'),
        }
    }
    static notExists (state) {
        return {
            name: 'not-exists',
            type: QUEUE_MEMBER.VALIDATOR,
            result: () => !state.exists ? true : new Error('field exists'),
        }
    }
}

class ValidationError extends Error {
    constructor (message, fields) {
        super(message)
        this.fields = fields
    }
}
class FieldError extends Error {
    constructor (validatorName, fieldName, message) {
        super(`${validatorName} on ${fieldName} is ${message}`)
        this.fieldName = fieldName
        this.validatorName = validatorName
    }
}

/* Definition */
Validator.ValidationError = ValidationError
Validator.FieldError = FieldError

module.exports = Validator

/* Private */
