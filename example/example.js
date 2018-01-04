const _ = require('lodash');
const Validator = require('../index');

function max(str, max) {
    return str.length <= max
}

let valid = new Validator()

valid.field('name', [
    Validator.filter((str) => String(str)),
    Validator.validator(max, 10),
    Validator.validator((str) => new Promise(res => setTimeout(() => res(true), 1000))),
])

valid.array('ages', [
    Validator.validator((item) => _.isNumber(item)),
])

valid.collection('drinks.alco', 'name', [
    Validator.validator(max, 10),
], [
    Validator.exists,
])

// try to change data to expect fails
valid.validate({
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
})
    .then(res => {
        console.log('Validation Success')
    })
    .catch(err => {
        console.error(err.message)
        for (let field of err.fields) {
            console.error(field.errors)
        }
    })