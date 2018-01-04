# week-validator
It is easy to use async validator based on ES6 features

# How to use

```js
// Init validator instance
let myValidator = new Validator()

// add field
myValidator.field('name', [
    Validator.filter((str) => String(str)),
    Validator.validator(max, 10),
    Validator.validator((str) => new Promise(res => setTimeout(() => res(true), 1000))),
])

myValidator.array('ages', [
    Validator.validator((item) => _.isNumber(item)),
])

myValidator.collection('drinks.alco', 'name', [
    Validator.validator(max, 10),
], [
    Validator.exists,
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
myValidator
  .validate(obj)
  .then(res => {
        console.log('Validation Success')
    })
    .catch(err => {
        console.error(err.message)
        for (let field of err.fields) {
            console.error(field.errors)
        }
    })
    
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

## Validator.validator(method, ...opts)
* *method* is the function that has to validate. It may be a promise, that has to return something not falseable.
* *opts* is prepared options.

## Validator.filter(method, ...opts)
* *method* is the function that has to filtrate. It may be a promise, that has to returns data instead input.
* *opts* is prepared options.

# Internal Validators

## Validator.exists
Check if param is exists in list, make an error if not.

## Validator.notExists
Check if param is exists in list, make error if it is.

# Contribution
Code is far from to be perfect. Feel free to create issues and PRs ;)
