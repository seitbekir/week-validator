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
            expect(Validator).to.have.property('required')
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

        it('should return filtered data into new object', async () => {
            const obj = {
                name: '  Messi   ',
                age: '32',
                filed: 'not needed',
                field2: { it: 'is needed', but: 'no validation required' },
            }

            const val = new Validator()

            val.field('name', [
                Validator.filter((str) => str.trim()),
            ])
            val.field('age', [
                Validator.filter((str) => Number(str)),
            ])
            val.field('field2')

            let result = await val.validate(obj)

            expect(result).to.have.property('name')
            expect(result).to.have.property('age')
            expect(result).not.to.have.property('field')
            expect(result).to.have.property('field2')

            expect(result.name).to.eql('Messi')
            expect(result.age).to.be(32)
            expect(typeof result.age).to.be('number')
        })
    })

    describe('Array checks', () => {
    })

    describe('Collection checks', () => {
    })

    describe('Edge cases checks', () => {
        it('should return data even in the absence', async () => {
            const obj = {
                age: '32',
            }

            const val = new Validator()

            val.field('name', [
                Validator.filter((str) => str.trim()),
            ])
            val.field('age', [
                Validator.filter((str) => Number(str)),
            ])

            let result = await val.validate(obj)

            expect(result).to.have.property('name')
            expect(result).to.have.property('age')

            expect(result.name).to.eql(null)
            expect(result.age).to.be(32)
        })

        it('should error out for required object', async () => {
            const obj = {
                age: '32',
            }

            const val = new Validator()

            val.field('name', [
                Validator.required,
            ])
            val.field('age', [
                Validator.filter((str) => Number(str)),
            ])

            try {
                await val.validate(obj)
            } catch (err) {
                expect(err instanceof Validator.ValidationError).to.be(true)

                expect(err.fields.length).to.be(1)
                expect(err.fields[0].name).to.eql('name')
                expect(err.fields[0].errors.length).to.be(1)
                expect(err.fields[0].errors[0].validatorName).to.eql('required')
            }
        })

        it('should error out if field repeats', async () => {
            const obj = {
                names: [
                    {
                        number: 1,
                        foo: 'bar',
                    },
                    {
                        number: 2,
                    },
                    {
                        number: 3,
                    },
                ],
            }

            const validators = {}

            validators.one = (str) => {
                return typeof str === 'object'
            }
            validators.two = (str) => {
                return typeof str === 'number'
            }

            const val = new Validator()

            val.field('names', [
                Validator.required,
            ])
            val.array('names', [
                Validator.validator(validators.one),
            ])
            val.collection('names', 'number', [
                Validator.validator(validators.two),
            ])

            try {
                val.field('names', [
                    Validator.filter((str) => Number(str)),
                ])
            } catch (err) {
                expect(err instanceof Validator.ValidatorError).to.be(true)
            }

            try {
                val.array('names', [
                    Validator.filter((str) => Number(str)),
                ])
            } catch (err) {
                expect(err instanceof Validator.ValidatorError).to.be(true)
            }

            try {
                val.collection('names', [
                    Validator.filter((str) => Number(str)),
                ])
            } catch (err) {
                expect(err instanceof Validator.ValidatorError).to.be(true)
            }

            await val.validate(obj)
        })
    })
})
