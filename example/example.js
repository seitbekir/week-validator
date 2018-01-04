const _ = require('lodash');
const Validator = require('../index');

function max(str, max) {
    return str.length <= max
}

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
myValidator.validate(obj)
    .then(res => {
        console.log('Validation Success')
    })
    .catch(err => {
        console.error(err.message)
        for (let field of err.fields) {
            console.error(field.errors)
        }
    })
