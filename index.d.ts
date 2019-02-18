// Type definitions for week-validator
// Project: https://github.com/seitbekir/week-validator

/* Errors */
declare class ValidatorError extends Error {
    /**
     * Field trying to set wrong validator
     */
    public fieldname: string

    constructor (message, fieldname): ValidatorError
}

declare class ValidationError extends Error {
    /**
     * Errors per field object
     */
    public fields: {
        /**
         * Field name
         */
        name: string
        /**
         * List of detected errors
         */
        errors: FieldError[]
    }[]

    constructor (message, fields): ValidationError
}

declare class FieldError extends Error {
    /**
     * Error describes A field params and validation failing.
     *
     * @param validatorName Validator Name
     * @param fieldName Name of field
     * @param message
     */
    constructor (validatorName: string, fieldName: string, message: string): FieldError
}

declare interface FlowStep {
    /**
     * Adding custom error message
     * @param message custom message
     */
    message(message: string): FlowStep
}

declare interface FlowStepMessageless {
}

declare class WeekValidator {
    constructor (): WeekValidator

    /**
     * keeps validation queue
     */
    const queues: []
    /**
     * keeps validation states
     */
    const states: []

    /**
     * Set if validator shold continue validation if error occured on a field
     * @param continueOnError
     */
    setContinueOnError (continueOnError: Boolean): WeekValidator

    /**
     * Apply list of filters and validators to field
     * @param name field name (use dots)
     * @param queue list of filters and validators
     * @throws {ValidatorError}
     */
    field (name: string, validators: any[]): WeekValidator
    /**
     * Apply list of filters and validators to each element of array
     * @param name field name (use dots)
     * @param queue list of filters and validators
     * @throws {ValidatorError}
     */
    array (name: string, validators: any[]): WeekValidator
    /**
     * Apply list of filters and validators to each element of collection
     * @param name field name (use dots)
     * @param subname field name inside collection object (use dots)
     * @param queue list of filters and validators
     * @throws {ValidatorError}
     */
    collection (name: string, subname: string, validators: any[]): WeekValidator
    /**
     * Run validation process
     * @param data data to ba validated
     * @returns Filtered and approved clear object
     * @throws {ValidationError}
     */
    validate (data: Object): Object

    /**
     * Register field Filter
     * @example
     * function foo (arg0, arg1, arg2) { return arg0 + arg1 }
     *
     * val.field('fieldname', [
     *     WeekValidator.filter(foo, arg1, arg2) // Arg0 is field value
     * ])
     * @param filter function that has to mutate input data
     * @param params additional arguments of filter function
     */
    static filter (filter: Function, ...params: any[]): FlowStep
    /**
     * Register field Validator
     * @example
     * function foo (arg0, arg1) { return arg0 === arg1 }
     *
     * val.field('fieldname', [
     *     WeekValidator.validator(foo, arg1) // Arg0 is field value
     * ])
     * @param validator function that has to mutate input data
     * @param params additional arguments of filter function
     */
    static validator (validator: Function, ...params: any[]): FlowStep

    static default(): FlowStepMessageless
    static required: FlowStepMessageless

    static ValidatorError = ValidatorError
    static ValidationError = ValidationError
    static FieldError = FieldError
}

export = WeekValidator;
