/// <reference path="./index.d.ts" />
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

        this.continueOnError = true
    }

    static get QUEUE_MEMBER () { return QUEUE_MEMBER }

    setContinueOnError (continueOnError) {
        this.continueOnError = continueOnError

        return this
    }

    /**
     * Apply list of filters and validators to field
     * @param {string} name field name (use dots)
     * @param {[]} queue list of filters and validators
     */
    field (name, queue) {
        checkNames(name, this.names)
        checkQueue(name, queue)
        this.names.push(name)

        this.queues.push({
            type: QUEUE_TYPE.FIELD,
            name,
            queue: queue || [],
        })

        return this
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
        checkQueue(name, queue)
        this.names.push(names)

        this.queues.push({
            type: QUEUE_TYPE.COLLECTION,
            name,
            subname,
            queue: queue || [],
        })

        return this
    }

    /**
     * Apply list of filters and validators to each element of array
     * @param {string} name field name (use dots)
     * @param {[]} queue list of filters and validators
     */
    array (name, queue = []) {
        let names = `${name}[]`
        checkNames(names, this.names)
        checkQueue(name, queue)
        this.names.push(names)

        this.queues.push({
            type: QUEUE_TYPE.ARRAY,
            name,
            queue: queue || [],
        })

        return this
    }

    async validate (object) {
        // group validation to subgroups
        let named = _.values(_.groupBy(this.queues, queue => queue.name))
        let states = []
        const promises = []

        for (let queues of named) {
            promises.push(fieldQueue(queues, object, states, this.continueOnError))
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
            _.set(form, state.name, state.data)
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
    static get required () {
        return {
            name: 'required',
            type: QUEUE_MEMBER.REQUIRED,
        }
    }
    static default (value) {
        return {
            name: 'default',
            type: QUEUE_MEMBER.REQUIRED,
            value,
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
function checkQueue (name, queue) {
    if (_.isArray(queue)) {
        if (queue.filter(q => q.type === QUEUE_MEMBER.REQUIRED).length > 1) {
            throw new ValidatorError(`Should be required or deffault only`, name)
        }
        if (queue.findIndex(q => q.type === QUEUE_MEMBER.REQUIRED) > 0) {
            throw new ValidatorError(`Required or default has to be first in queue`, name)
        }
        if (queue.some(q => typeof q !== 'function' && !isRequired(q))) {
            throw new Error(`Queue of ${name} has non-function validator or filter`)
        }
    }
    if (!_.isArray(queue) && !_.isUndefined(queue)) {
        throw new ValidatorError(`Validation queue has to be array or undefined`, name)
    }
}
function isRequired (q) {
    if (typeof q !== 'function' && q && q.type === QUEUE_MEMBER.REQUIRED) {
        return true
    }
    return false
}

async function fieldQueue (queues, object, states, continueOnError = false) {
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

    const substates = []
    for (let queue of queues) {
        if (queue.type === QUEUE_TYPE.FIELD) {
            await fieldQueueField(queue, state, continueOnError)
        }
        if (queue.type === QUEUE_TYPE.ARRAY) {
            await fieldQueueArray(queue, state, continueOnError)
        }
        if (queue.type === QUEUE_TYPE.COLLECTION) {
            const s = await fieldQueueCollection(queue, state, continueOnError)
            substates.push(...s)
        }
    }

    if (substates.length) {
        const data = []
        for (const substate of substates) {
            _.set(data, `[${substate.index}].${substate.subname}`, substate.data)
        }
        state.data = data
    }
}

async function fieldQueueField (queue, state, continueOnError) {
    if (state.exists === false && isRequired(queue.queue[0])) {
        if (queue.queue[0].name === 'required') {
            state.errors.push(new FieldError('required', state.name, `${state.name} is Required`))
        }
        if (queue.queue[0].name === 'default') {
            state.data = queue.queue[0].value
        }
    }

    if (state.exists === false) {
        return true
    }
    for (let q of queue.queue) {
        if (typeof q !== 'function') {
            continue
        }
        let el = q(state)
        try {
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

            if (continueOnError === false) {
                break
            }
        }
    }
    return true
}

async function fieldQueueArray (queue, state, continueOnError = false) {
    if (state.exists === false) {
        return true
    }

    for (let ind of state.data.keys()) {
        let name = state.name + `[${ind}]`
        for (let q of queue.queue) {
            if (typeof q !== 'function') {
                continue
            }
            let el = q(state)

            try {
                if (el.type === QUEUE_MEMBER.FILTER) {
                    state.data[ind] = await el.result(state.data[ind])
                }
                if (el.type === QUEUE_MEMBER.VALIDATOR) {
                    let d = await el.result(state.data[ind])
                    if (!d) {
                        throw new FieldError(el.name, name)
                    }
                }
            } catch (err) {
                err.message = el.message(err.message, name)
                state.errors.push(FieldError.fromError(el.name, name, err))

                if (continueOnError === false) {
                    break
                }
            }
        }
    }
    return true
}

async function fieldQueueCollection (queue, state, continueOnError = false) {
    if (state.exists === false) {
        return []
    }

    const substates = []

    for (let ind of state.data.keys()) {
        let name = `${state.name}[${ind}].${queue.subname}`
        const substate = {
            name,
            subname: queue.subname,
            index: ind,
            data: _.get(state.data[ind], queue.subname, null),
            exists: _.has(state.data[ind], queue.subname),
            errors: [],
        }
        substates.push(substate)

        if (substate.exists === false && isRequired(queue.queue[0])) {
            if (queue.queue[0].name === 'required') {
                state.errors.push(new FieldError('required', state.name, `${substate.name} is Required`))
            }
            if (queue.queue[0].name === 'default') {
                _.set(substate.data, queue.subname, queue.queue[0].value)
            }
        }

        if (substate.exists === false) {
            continue
        }

        for (let q of queue.queue) {
            if (typeof q !== 'function') {
                continue
            }
            let el = q(state)

            try {
                if (el.type === QUEUE_MEMBER.FILTER) {
                    substate.data = await el.result(substate.data)
                }
                if (el.type === QUEUE_MEMBER.VALIDATOR) {
                    let d = await el.result(substate.data)
                    if (!d) {
                        throw new FieldError(el.name, name)
                    }
                }
            } catch (err) {
                err.message = el.message(err.message, substate.name)
                state.errors.push(FieldError.fromError(el.name, name, err))

                if (continueOnError === false) {
                    break
                }
            }
        }
    }

    return substates
}
