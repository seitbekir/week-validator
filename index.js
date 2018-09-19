/**
 * Week validator is very light validator that made to work with
 * sync and async validation in same stack.
 */
const _ = require('lodash')

const QUEUE_TYPE = {
    FIELD: 'field',
    COLLECTION: 'collection',
    ARRAY: 'array',
}
const QUEUE_MEMBER = {
    REQUIRED: 'required',
    VALIDATOR: 'validator',
    FILTER: 'filter',
}

class Validator {
    constructor () {
        this.queues = []
        this.states = {}
        this.names = []
    }

    static get QUEUE_MEMBER () { return QUEUE_MEMBER }

    /**
     * Apply list of filters and validators to field
     * @param {string} name field name (use dots)
     * @param {[]} queue list of filters and validators
     */
    field (name, queue) {
        checkNames(name, this.names)
        this.names.push(name)

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
     */
    collection (name, subname, queue = []) {
        let names = `${name}[]${subname}`
        checkNames(names, this.names)
        this.names.push(names)

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
     */
    array (name, queue = []) {
        let names = `${name}[]`
        checkNames(names, this.names)
        this.names.push(names)

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
        const promises = []

        for (let queues of named) {
            promises.push(fieldQueue(queues, object, states))
        }

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
            throw new Error('Filter method is not a function')
        }

        let message = null

        const result = (state) => {
            return {
                name: method.name || 'custom filter',
                type: QUEUE_MEMBER.FILTER,
                result: (data) => method.apply(null, [data, ...opts]),
                message (m, name) {
                    if (typeof message === 'function') {
                        return message(name)
                    }
                    if (typeof message === 'string') {
                        return message
                    }
                    return m
                },
            }
        }

        result.message = (m) => {
            message = m
            return result
        }

        return result
    }

    static validator (method, ...opts) {
        if (typeof method !== 'function') {
            throw new Error('Validator method is not a function')
        }

        let message = null

        const result = (state) => {
            return {
                name: method.name || 'custom validator',
                type: QUEUE_MEMBER.VALIDATOR,
                result: (data) => method.apply(null, [data, ...opts]),
                message (m, name) {
                    if (typeof message === 'function') {
                        return message(name)
                    }
                    if (typeof message === 'string') {
                        return message
                    }
                    return m
                },
            }
        }

        result.message = (m) => {
            message = m
            return result
        }

        return result
    }

    // Custor validators
    static required (state) {
        return {
            name: 'required',
            type: QUEUE_MEMBER.REQUIRED,
        }
    }
}

class ValidatorError extends Error {
    constructor (message, fieldname) {
        super(message)
        this.fieldname = fieldname
    }
}
class ValidationError extends Error {
    constructor (message, fields) {
        super(message)
        this.fields = fields
    }
}
class FieldError extends Error {
    /**
     * Error describes A field params and validation failing.
     *
     * @param {String} validatorName Validator Name
     * @param {String} fieldName Name of field
     * @param {String} message
     */
    constructor (validatorName, fieldName, message) {
        super(message || `${validatorName} on ${fieldName} is invalid`)
        this.fieldName = fieldName
        this.validatorName = validatorName
    }

    toJSON () {
        return {
            field: this.fieldName,
            validator: this.validatorName,
            message: this.message,
        }
    }

    /**
     * Created Field Error from any error
     *
     * @param {Error} error Error object
     */
    static fromError (validatorName, fieldName, error) {
        return new FieldError(validatorName, fieldName, error.message)
    }
}

/* Definition */
Validator.ValidatorError = ValidatorError
Validator.ValidationError = ValidationError
Validator.FieldError = FieldError

module.exports = Validator

/* Private */
function checkNames (name, names) {
    if (names.includes(name)) {
        throw new ValidatorError(`${name} field already defined`, name)
    }
}

async function fieldQueue (queues, object, states) {
    // console.log(queues)
    const name = queues[0].name
    let state = {
        name,
        data: _.get(object, name, null),
        exists: _.has(object, name),
        errors: [],
    }
    states.push(state)

    queues = _.sortBy(queues, queue => {
        switch (true) {
        case queue.type === QUEUE_TYPE.FIELD:
            return 0
        case queue.type === QUEUE_TYPE.ARRAY:
            return 1
        case queue.type === QUEUE_TYPE.COLLECTION:
            return 2
        }
    })

    for (let queue of queues) {
        if (queue.type === QUEUE_TYPE.FIELD) {
            await fieldQueueField(queue, state)
        }
        if (queue.type === QUEUE_TYPE.ARRAY) {
            await fieldQueueArray(queue, state)
        }
        if (queue.type === QUEUE_TYPE.COLLECTION) {
            await fieldQueueCollection(queue, state)
        }
    }
}

async function fieldQueueField (queue, state) {
    if (state.exists === false && queue.queue.find(q => q === Validator.required)) {
        state.errors.push(new FieldError('required', state.name, `${state.name} is Required`))
    }
    if (state.exists === false) {
        return true
    }
    for (let q of queue.queue) {
        if (typeof q !== 'function') {
            throw new Error(`Queue of ${state.name} has non-function validator or filter`)
        }
        let el = q(state)
        try {
            if (el.type === QUEUE_MEMBER.REQUIRED) {
                continue
            }
            if (el.type === QUEUE_MEMBER.FILTER) {
                state.data = await el.result(state.data)
            }
            if (el.type === QUEUE_MEMBER.VALIDATOR) {
                let d = await el.result(state.data)
                if (!d) {
                    throw new FieldError(el.name, state.name)
                }
            }
        } catch (err) {
            err.message = el.message(err.message, state.name)
            state.errors.push(FieldError.fromError(el.name, state.name, err))
        }
    }
    return true
}

async function fieldQueueArray (queue, state) {
    if (state.exists === false) {
        return true
    }
    for (let q of queue.queue) {
        if (typeof q !== 'function') {
            throw new Error(`Queue of ${state.name} has non-function validator or filter`)
        }
        let el = q(state)
        if (el.type === QUEUE_MEMBER.FILTER) {
            for (let ind of state.data.keys()) {
                let name = state.name + `[${ind}]`

                try {
                    state.data[ind] = await el.result(state.data[ind])
                } catch (err) {
                    err.message = el.message(err.message, name)
                    state.errors.push(FieldError.fromError(el.name, name, err))
                }
            }
        }
        if (el.type === QUEUE_MEMBER.VALIDATOR) {
            for (let ind of state.data.keys()) {
                let name = state.name + `[${ind}]`

                try {
                    let d = await el.result(state.data[ind])
                    if (!d) {
                        throw new FieldError(el.name, name)
                    }
                } catch (err) {
                    err.message = el.message(err.message, name)
                    state.errors.push(FieldError.fromError(el.name, name, err))
                }
            }
        }
    }
    return true
}

async function fieldQueueCollection (queue, state) {
    if (state.exists === false) {
        return true
    }
    for (let q of queue.queue) {
        if (typeof q !== 'function') {
            throw new Error(`Queue of ${state.name} has non-function validator or filter`)
        }
        let el = q(state)
        if (el.type === QUEUE_MEMBER.FILTER) {
            for (let ind of state.data.keys()) {
                let name = state.name + `[${ind}].` + queue.subname

                try {
                    let d = await el.result(_.get(state.data[ind], queue.subname))
                    _.set(state.data[ind], queue.subname, d)
                } catch (err) {
                    err.message = el.message(err.message, name)
                    state.errors.push(FieldError.fromError(el.name, name, err))
                }
            }
        }
        if (el.type === QUEUE_MEMBER.VALIDATOR) {
            for (let ind of state.data.keys()) {
                let name = state.name + `[${ind}].` + queue.subname

                try {
                    let d = await el.result(_.get(state.data[ind], queue.subname))
                    if (!d) {
                        throw new FieldError(el.name, name)
                    }
                } catch (err) {
                    err.message = el.message(err.message, name)
                    state.errors.push(FieldError.fromError(el.name, name, err))
                }
            }
        }
    }
    return true
}
