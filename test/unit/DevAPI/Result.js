'use strict';

/* eslint-env node, mocha */

const expect = require('chai').expect;
const result = require('../../../lib/DevAPI/Result');

describe('Result', () => {
    context('getAffectedItemsCount()', () => {
        it('returns the same result as getAffectedRowsCount()', () => {
            const res = result({ rowsAffected: 3 });

            expect(res.getAffectedItemsCount()).to.equal(res.getAffectedRowsCount());
        });
    });

    context('getAffectedRowsCount()', () => {
        it('returns the number of rows affected by an operation', () => {
            expect(result({ rowsAffected: 3 }).getAffectedRowsCount()).to.equal(3);
        });
    });

    context('getAutoIncrementValue()', () => {
        it('returns the first value generated by "AUTO INCREMENT" for a given operation', () => {
            expect(result({ generatedInsertId: 1 }).getAutoIncrementValue()).to.equal(1);
        });
    });

    context('getGeneratedIds()', () => {
        it('returns the list of document ids generated by the server for a given operation', () => {
            const generatedDocumentIds = ['foo', 'bar'];

            expect(result({ generatedDocumentIds }).getGeneratedIds()).to.deep.equal(generatedDocumentIds);
        });
    });

    context('getWarnings()', () => {
        it('returns the list of warnings generated by the server for a given operation', () => {
            const warnings = ['foo', 'bar'];

            expect(result({ warnings }).getWarnings()).to.deep.equal(warnings);
        });
    });

    context('getWarningsCount()', () => {
        it('returns the number of warnings generated by the server for a given operation', () => {
            const warnings = ['foo', 'bar', 'baz'];

            expect(result({ warnings }).getWarningsCount()).to.deep.equal(3);
        });
    });
});
