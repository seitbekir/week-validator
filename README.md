# week-validator
It is easy to use async validator based on ES6 features

# How to use

```js
// Init validator instance
let myValidator = new Validator()

// add fields
myValidator.field('name', [
    Validator.filter((str) => String(str)),
    Validator.validator(max, 10).message('Too long name'),
    Validator.validator((str) => new Promise(resolve => setTimeout(() => resolve(true), 1000))),
])

myValidator.array('ages', [
    Validator.validator((item) => _.isNumber(item)),
    Validator.validator((item) => item > 9).message((name) => `${name} is less that 10`),
])

myValidator.field('drinks.alco', [
    Validator.required,
])
myValidator.array('drinks.alco', [
    Validator.validator((item) => _.isObject(item)),
])
myValidator.collection('drinks.alco', 'name', [
    Validator.validator(max, 10).message((name) => `${name} is too long`),
])

// Object to validate
const obj = {
    name: 'hello',
    ages: [10, 25],
    drinks: {
        alco: [
            {
                name: 'Vodka',
            },
            {
                name: 'Beer',
            },
        ],
    },
}

// validate
try {
    await myValidator.validate(obj)
    console.log('Validation Success')
} catch (err) {
    console.error(err.message)
    for (let field of err.fields) {
        console.error(field.errors)
    }
}

 // full varsion in example/example.js
```

# Some explanation

To use validator it is not enough just add functions to array. It has to be prepared.
It is easy to create validation or filtration function.

```js
// let any function to validate be
_.isString // from lodash

let myIsString = Validator.validator(_.isString)
let myConvertToString = Validator.filter((str) => String(str))
```

## new Validator()
Initialize a validator object.

## myValidator.field(fieldName, validationQueue)
This function applies a field validation queue by field name. For nested field names use dot notation (`a.b[0].c`).

Can be used once for a filed name.

## myValidator.array(fieldName, validationQueue)
This function applies a validation queue for each element of array gotten by field name. For nested field names use dot notation (`a.b[0].c`).

Can be used once for a filed name.

## myValidator.collection(fieldName, subFieldName, validationQueue)
This function applies a validation queue for each element of collection gotten by field name and internam path on object from `subFieldName`. For nested field names use dot notation (`a.b[0].c`) on both.

Can be used once for a filed name and sub field name.

Following methods allow you to use any function as a validator or filter in validation queue.

## Validator.validator(method, ...opts)
Validator is the function, that accept or decline data validity for an input. For example, if you expect a string with ength 10, but the field contains `"abcdefghigk"`, the function has to return `false`. If a validation function uses promise, then true or false expects as argument in `then()` or as a catch.

* *method* is the validation function. (sync or async)
* *opts* is prepared options.
* *returns* { message(text) }

## Validator.filter(method, ...opts)
Filter is the function which mutates an input data. For example, you may convert any type to `Number` or trim a string. If a filter function uses promise, then filter expects a mutated data in `then()`. Or catch for errors. (for custom errors use `Validator.FieldError`)

* *method* is the filter function. (sync or async)
* *opts* is prepared options.
* *returns* { message(text) }

## Validator.[validator(...)|filter(...)].message(text: String|Function)
Instead of default message of error you able to define your own.

* *name* as function takes argument `name` to be set internally. Ex.: ``.message((name) => `${name} is wrong!`)``

# Internal Validators

## Validator.required
Check if param is exists in list, make an error if not.

# Contribution
Code is far from to be perfect. Feel free to create issues and PRs ;)
