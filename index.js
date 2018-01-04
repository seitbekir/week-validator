const _ = require('lodash');

function Validator() {
    this.queues = []
    this.states = {}
}

const QUEUE_TYPE = {
    FIELD: 'field',
    COLLECTION: 'collection',
    ARRAY: 'array',
}
const QUEUE_MEMBER = {
    VALIDATOR: 'validator',
    FILTER: 'filter',
}

Validator.QUEUE_MEMBER = QUEUE_MEMBER;

/**
 * Apply list of filters and validators to field
 * @param {string} name field name (use dots)
 * @param {[]} queue list of filters and validators
 */
Validator.prototype.field = function(name, queue) {
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
Validator.prototype.collection = function(name, subname, queue, queueAsField) {
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
Validator.prototype.array = function(name, queue, queueAsField) {
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
Validator.prototype.validate = async function(object) {
    let promises = []
    // group validation to subgroups
    let named = _.values(_.groupBy(this.queues, queue => queue.name))
    let states = []
    promises = _.mapValues(named, async (queues) => {
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
                    } catch(err) {
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
                                } catch(err) {
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
                                } catch(err) {
                                    state.errors.push(err)
                                }
                            })
                        }
                    } catch(err) {
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
                                } catch(err) {
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
                                } catch(err) {
                                    state.errors.push(err)
                                }
                            })
                        }
                    } catch(err) {
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
}

Validator.filter = function(method, ...opt) {
    if (typeof method !== 'function') {
        return null
    }
    return function(state) {
        return {
            name: method.name || 'custom filter',
            type: QUEUE_MEMBER.FILTER,
            result: (data) => method.apply(null, [data, ...opt])
        }
    }
}

Validator.validator = function(method, ...opt) {
    if (typeof method !== 'function') {
        return null
    }
    return function(state) {
        return {
            name: method.name || 'custom validator',
            type: QUEUE_MEMBER.VALIDATOR,
            result: (data) => method.apply(null, [data, ...opt])
        }
    }
}

// Custor validators
Validator.exists = function(state) {
    return {
        name: 'exists',
        type: QUEUE_MEMBER.VALIDATOR,
        result: () => state.exists ? true : new Error('field not exists'),
    }
}
Validator.notExists = function(state) {
    return {
        name: 'not-exists',
        type: QUEUE_MEMBER.VALIDATOR,
        result: () => !state.exists ? true : new Error('field exists'),
    }
}

module.exports = Validator

class ValidationError extends Error {
    constructor(message, fields) {
        super(message)
        this.fields = fields
    }
}
class FieldError extends Error {
    constructor(validatorName, fieldName, message) {
        super(`${validatorName} on ${fieldName} is ${message}`)
        this.fieldName = fieldName
        this.validatorName = validatorName
    }
}

Validator.ValidationError = ValidationError
Validator.FieldError = FieldError
