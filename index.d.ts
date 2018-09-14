// Type definitions for week-validator 3.0
// Project: https://github.com/seitbekir/week-validator

declare namespace WeekValidator {
    interface Validator {
        field(name: string, validators: void[]): void;
        validate(): Object;

        static filter(filter: Function, ...params: any[]): void;
        static validator(filter: Function, ...params: any[]): void;
        static required: Function,
    }

    interface WeekValidatorStatic {
        filter(filter: Function, ...params: any[]): void;
        validator(filter: Function, ...params: any[]): void;
        required: Function,
    }
}

declare module "week-validator" {
    export = WeekValidator.Validator;
}
