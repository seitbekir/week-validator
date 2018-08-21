/* globals describe, it */
const expect = require('expect.js')
const { spy } = require('sinon')

describe('Validator', () => {
    const Validator = require('../index')

    describe('Initial checks', () => {
        it('should init Validation object', () => {
            const validator = new Validator()

            expect(validator).to.have.property('queues')
            expect(validator).to.have.property('states')
            expect(validator).to.have.property('field')
            expect(validator).to.have.property('collection')
            expect(validator).to.have.property('array')
            expect(validator).to.have.property('validate')

            expect(validator.queues).to.empty()
            expect(validator.states).to.empty()
            expect(validator.field).to.be.a('function')
            expect(validator.collection).to.be.a('function')
            expect(validator.array).to.be.a('function')
            expect(validator.validate).to.be.a('function')
        })
        it('should has static methods', () => {
            expect(Validator).to.have.property('filter')
            expect(Validator).to.have.property('validator')

            expect(Validator.filter).to.be.a('function')
            expect(Validator.validator).to.be.a('function')
        })
        it('should has two basic validation static methods', () => {
            expect(Validator).to.have.property('exists')
            expect(Validator).to.have.property('notExists')
        })
    })

    describe('Validation checks', () => {
        it('should run validation in defined queue', async () => {
            const validators = {}

            validators.one = (str) => {
                return typeof str === 'number'
            }
            validators.two = (str) => {
                return typeof str === 'number'
            }

            spy(validators, 'one')
            spy(validators, 'two')

            const val = new Validator()

            val.field('age', [
                Validator.validator(validators.one),
                Validator.validator(validators.two),
            ])

            await val.validate({ age: 20 })

            expect(validators.one.calledOnce).to.be(true)
            expect(validators.two.calledOnce).to.be(true)
            expect(validators.two.calledAfter(validators.one)).to.be(true)
        })
        it('should should not interupt validation fall on fail', async () => {
            const validators = {}

            validators.one = (str) => {
                return typeof str === 'number'
            }
            validators.two = (str) => {
                return typeof str === 'function' // this has to fail
            }
            validators.tri = (str) => {
                return typeof str === 'number'
            }

            spy(validators, 'one')
            spy(validators, 'two')
            spy(validators, 'tri')

            const val = new Validator()

            val.field('age', [
                Validator.validator(validators.one),
                Validator.validator(validators.two),
                Validator.validator(validators.tri),
            ])

            try {
                await val.validate({ age: 20 })
            } catch (err) {
                expect(err instanceof Validator.ValidationError).to.be(true)

                expect(validators.one.calledOnce).to.be(true)
                expect(validators.two.calledOnce).to.be(true)
                expect(validators.tri.calledOnce).to.be(true)

                expect(validators.two.calledAfter(validators.one)).to.be(true)
            }
        })
    })

    describe('Filtering checks', () => {
        it('should validate filtered data in queue', async () => {
            const validators = {}

            validators.one = (str) => {
                return Number(str)
            }
            validators.two = (str) => {
                return typeof str === 'number'
            }

            spy(validators, 'one')
            spy(validators, 'two')

            const val = new Validator()

            val.field('age', [
                Validator.filter(validators.one),
                Validator.validator(validators.two),
            ])

            await val.validate({ age: '20' })

            expect(validators.one.calledOnce).to.be(true)
            expect(validators.two.calledOnce).to.be(true)
            expect(validators.two.calledAfter(validators.one)).to.be(true)
        })
    })
})