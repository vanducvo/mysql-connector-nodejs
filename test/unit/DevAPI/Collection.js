'use strict';

/* eslint-env node, mocha */

const expect = require('chai').expect;
const result = require('../../../lib/DevAPI/Result');
const statement = require('../../../lib/DevAPI/Statement');
const td = require('testdouble');

describe('Collection', () => {
    let collection, execute, sqlExecute;

    beforeEach('create fakes', () => {
        execute = td.function();
        sqlExecute = td.function();
        sqlExecute.Namespace = statement.Type;

        td.replace('../../../lib/DevAPI/SqlExecute', sqlExecute);
        collection = require('../../../lib/DevAPI/Collection');
    });

    afterEach('reset fakes', () => {
        td.reset();
    });

    context('getName()', () => {
        it('returns the collection name', () => {
            expect(collection(null, null, 'foobar').getName()).to.equal('foobar');
        });
    });

    context('getSchema()', () => {
        it('returns the instance of the collection schema', () => {
            const getSchema = td.function();
            const getName = td.function();
            const session = { getSchema };
            const schema = { getName };
            const coll = collection(session, schema, 'bar');

            td.when(getName()).thenReturn('foo');
            td.when(getSchema('foo')).thenReturn(schema);

            return expect(coll.getSchema().getName()).to.equal('foo');
        });
    });

    context('getSession()', () => {
        it('returns the associated session', () => {
            const instance = collection({ foo: 'bar' });

            expect(instance.getSession()).to.deep.equal({ foo: 'bar' });
        });
    });

    context('existsInDatabase()', () => {
        it('returns true if exists in database', () => {
            const getName = td.function();
            const schema = { getName };
            const instance = collection('foo', schema, 'baz');

            td.when(getName()).thenReturn('bar');
            td.when(execute(td.callback(['baz']))).thenResolve();
            td.when(sqlExecute('foo', 'list_objects', [{ schema: 'bar', filter: 'baz' }], 'mysqlx')).thenReturn({ execute });

            return instance.existsInDatabase()
                .then(actual => expect(actual).to.be.true);
        });

        it('returns false if it does not exist in database', () => {
            const getName = td.function();
            const schema = { getName };
            const instance = collection('foo', schema, 'baz');

            td.when(getName()).thenReturn('bar');
            td.when(execute(td.callback([]))).thenResolve();
            td.when(sqlExecute('foo', 'list_objects', [{ schema: 'bar', filter: 'baz' }], 'mysqlx')).thenReturn({ execute });

            return instance.existsInDatabase()
                .then(actual => expect(actual).to.be.false);
        });
    });

    context('count()', () => {
        it('returns the number of documents in a collection', () => {
            const getName = td.function();
            const schema = { getName };
            const instance = collection('foo', schema, 'baz');

            td.when(getName()).thenReturn('bar');
            td.when(execute(td.callback([1]))).thenResolve();
            td.when(sqlExecute('foo', 'SELECT COUNT(*) FROM `bar`.`baz`')).thenReturn({ execute });

            return instance.count()
                .then(actual => expect(actual).to.equal(1));
        });

        it('fails if an unexpected error is thrown', () => {
            const getName = td.function();
            const schema = { getName };
            const instance = collection('foo', schema, 'baz');
            const error = new Error('foobar');

            td.when(getName()).thenReturn('bar');
            td.when(execute(td.callback([1]))).thenReject(error);
            td.when(sqlExecute('foo', 'SELECT COUNT(*) FROM `bar`.`baz`')).thenReturn({ execute });

            return instance.count()
                .then(() => expect.fail('must fail'))
                .catch(err => expect(err).to.deep.equal(error));
        });

        // TODO(Rui): Maybe this will become the job of the plugin at some point.
        it('replaces "Table" by "Collection" on server error messages', () => {
            const getName = td.function();
            const schema = { getName };
            const instance = collection('foo', schema, 'baz');
            const error = new Error("Table 'bar.baz' doesn't exist.");

            td.when(getName()).thenReturn('bar');
            td.when(execute(td.callback([1]))).thenReject(error);
            td.when(sqlExecute('foo', 'SELECT COUNT(*) FROM `bar`.`baz`')).thenReturn({ execute });

            return instance.count()
                .then(() => expect.fail())
                .catch(err => expect(err.message).to.equal("Collection 'bar.baz' doesn't exist."));
        });
    });

    context('inspect()', () => {
        it('hides internals', () => {
            const getName = td.function();
            const schema = { getName };
            const instance = collection(null, schema, 'bar');
            const expected = { schema: 'foo', collection: 'bar' };

            td.when(getName()).thenReturn('foo');

            expect(instance.inspect()).to.deep.equal(expected);
        });
    });

    context('add()', () => {
        it('returns an instance of the proper class', () => {
            const instance = collection().add({});

            expect(instance.getClassName()).to.equal('CollectionAdd');
        });

        it('acknowledges documents provided as an array', () => {
            const documents = [{ foo: 'bar' }, { foo: 'baz' }];
            const instance = collection().add(documents);

            expect(instance.getItems()).to.deep.equal(documents);
        });

        it('acknowledges documents provided as multiple arguments', () => {
            const documents = [{ foo: 'bar' }, { foo: 'baz' }];
            const instance = collection().add(documents[0], documents[1]);

            expect(instance.getItems()).to.deep.equal(documents);
        });
    });

    context('modify()', () => {
        it('returns an operation instance for a valid condition query', () => {
            const session = 'foo';
            const schema = 'bar';
            const name = 'baz';
            const query = 'true';
            const instance = collection(session, schema, name).modify(query);

            expect(instance.getClassName()).to.equal('CollectionModify');
        });
    });

    context('replaceOne()', () => {
        let collectionModify, execute, setDouble;

        beforeEach('create fakes', () => {
            collectionModify = td.function();
            execute = td.function();
            setDouble = td.function();

            td.replace('../../../lib/DevAPI/CollectionModify', collectionModify);
            collection = require('../../../lib/DevAPI/Collection');
        });

        it('returns the result of executing a modify operation for a given document', () => {
            const instance = collection('foo', 'bar', 'baz');
            const state = { ok: true };
            const expected = result(state);

            td.when(execute()).thenResolve(expected);
            td.when(setDouble('$', { a: 'quux' })).thenReturn({ execute });
            td.when(collectionModify('foo', 'bar', 'baz', '_id = "qux"')).thenReturn({ set: setDouble });

            return instance.replaceOne('qux', { a: 'quux' })
                .then(actual => expect(actual).to.deep.equal(expected));
        });

        it('escapes the id value', () => {
            // eslint-disable-next-line no-useless-escape
            const documentId = 'b\"ar';
            const criteria = `_id = "b\\"ar"`;
            const instance = collection('foo', 'bar', 'baz');
            const state = { ok: true };
            const expected = result(state);

            td.when(execute()).thenResolve(expected);
            td.when(setDouble(), { ignoreExtraArgs: true }).thenReturn({ execute });
            td.when(collectionModify('foo', 'bar', 'baz', criteria)).thenReturn({ set: setDouble });

            return instance.replaceOne(documentId, { a: 'a' })
                .then(actual => expect(actual).to.deep.equal(expected));
        });

        it('fails if an unexpected error is thrown when modifying the document', () => {
            const instance = collection('foo', 'bar', 'baz');
            const error = new Error('foobar');

            td.when(execute()).thenReject(error);
            td.when(setDouble(), { ignoreExtraArgs: true }).thenReturn({ execute });
            td.when(collectionModify('foo', 'bar', 'baz', '_id = "qux"')).thenReturn({ set: setDouble });

            return instance.replaceOne('qux', { a: 'quux' })
                .then(() => expect.fail())
                .catch(err => expect(err).to.deep.equal(error));
        });
    });

    context('addOrReplaceOne()', () => {
        let collectionAdd, execute;

        beforeEach('create fakes', () => {
            collectionAdd = td.function();
            execute = td.function();

            td.replace('../../../lib/DevAPI/CollectionAdd', collectionAdd);
            collection = require('../../../lib/DevAPI/Collection');
        });

        it('returns the result of executing a "upsert" operation for a given document', () => {
            const expected = { ok: 'true' };
            const name = 'foo';
            const schema = 'baz';
            const session = 'qux';
            const instance = collection(session, schema, name);

            td.when(execute()).thenResolve(expected);
            td.when(collectionAdd(session, schema, name, [{ _id: 'foo', name: 'bar' }], { upsert: true })).thenReturn({ execute });

            return instance.addOrReplaceOne('foo', { name: 'bar' })
                .then(actual => expect(actual).to.deep.equal(expected));
        });

        it('escapes the id value', () => {
            const expected = { ok: 'true' };
            const name = 'foo';
            const schema = 'baz';
            const session = 'qux';
            const instance = collection(session, schema, name);

            td.when(execute()).thenResolve(expected);
            td.when(collectionAdd(session, schema, name, [{ _id: 'fo\\"o', name: 'bar' }], { upsert: true })).thenReturn({ execute });

            return instance.addOrReplaceOne('fo"o', { name: 'bar' })
                .then(actual => expect(actual).to.deep.equal(expected));
        });

        it('ignores any additional `_id` property', () => {
            const expected = { ok: 'true' };
            const name = 'foo';
            const schema = 'baz';
            const session = 'qux';
            const instance = collection(session, schema, name);

            td.when(execute()).thenResolve(expected);
            td.when(collectionAdd(session, schema, name, [{ _id: 'foo', name: 'bar' }], { upsert: true })).thenReturn({ execute });

            return instance.addOrReplaceOne('foo', { _id: 'baz', name: 'bar' })
                .then(actual => expect(actual).to.deep.equal(expected));
        });

        it('fails if an unexpected error is thrown', () => {
            const error = new Error('foobar');
            const name = 'foo';
            const schema = 'baz';
            const session = 'qux';
            const instance = collection(session, schema, name);

            td.when(execute()).thenReject(error);
            td.when(collectionAdd(session, schema, name, [{ _id: 'foo', name: 'bar' }], { upsert: true })).thenReturn({ execute });

            return instance.addOrReplaceOne('foo', { _id: 'baz', name: 'bar' })
                .then(() => expect.fail())
                .catch(err => expect(err).to.deep.equal(error));
        });
    });

    context('getOne()', () => {
        let collectionFind, execute;

        beforeEach('create fakes', () => {
            collectionFind = td.function();
            execute = td.function();

            td.replace('../../../lib/DevAPI/CollectionFind', collectionFind);
            collection = require('../../../lib/DevAPI/Collection');
        });

        it('returns the document instance if it exists', () => {
            const collectionName = 'foobar';
            const documentId = 'foo';
            const criteria = `_id = "${documentId}"`;
            const expected = { _id: documentId, name: 'bar' };
            const schema = 'baz';
            const session = 'qux';
            const instance = collection(session, schema, collectionName);

            td.when(execute(td.callback(expected))).thenResolve();
            td.when(collectionFind(session, schema, collectionName, criteria)).thenReturn({ execute });

            return instance.getOne(documentId)
                .then(actual => expect(actual).to.deep.equal(expected));
        });

        it('escapes the id value', () => {
            const collectionName = 'foobar';
            // eslint-disable-next-line no-useless-escape
            const documentId = 'fo\"o';
            const criteria = `_id = "fo\\"o"`;
            const expected = { _id: documentId, name: 'bar' };
            const schema = 'baz';
            const session = 'qux';
            const instance = collection(session, schema, collectionName);

            td.when(execute(td.callback(expected))).thenResolve();
            td.when(collectionFind(session, schema, collectionName, criteria)).thenReturn({ execute });

            return instance.getOne(documentId)
                .then(actual => expect(actual).to.deep.equal(expected));
        });

        it('returns `null` if the document does not exist', () => {
            const collectionName = 'foobar';
            const documentId = 'foo';
            const criteria = `_id = "${documentId}"`;
            const schema = 'baz';
            const session = 'qux';
            const instance = collection(session, schema, collectionName);

            td.when(execute(td.matchers.isA(Function))).thenResolve();
            td.when(collectionFind(session, schema, collectionName, criteria)).thenReturn({ execute });

            return instance.getOne(documentId)
                .then(actual => expect(actual).to.be.null);
        });
    });

    context('removeOne()', () => {
        let collectionRemove, execute;

        beforeEach('create fakes', () => {
            collectionRemove = td.function();
            execute = td.function();

            td.replace('../../../lib/DevAPI/CollectionRemove', collectionRemove);
            collection = require('../../../lib/DevAPI/Collection');
        });

        it('returns the document instance if it exists', () => {
            const documentId = 'foo';
            const state = { rows_affected: 1 };
            const expected = result(state);
            const criteria = `_id = "${documentId}"`;
            const instance = collection('bar', 'baz', 'qux');

            td.when(execute()).thenResolve(expected);
            td.when(collectionRemove('bar', 'baz', 'qux', criteria)).thenReturn({ execute });

            return instance.removeOne(documentId)
                .then(actual => expect(actual).to.deep.equal(expected));
        });

        it('escapes the id value', () => {
            // eslint-disable-next-line no-useless-escape
            const documentId = 'fo\"o';
            const state = { rows_affected: 1 };
            const expected = result(state);
            const criteria = `_id = "fo\\"o"`;
            const instance = collection('bar', 'baz', 'qux');

            td.when(execute()).thenResolve(expected);
            td.when(collectionRemove('bar', 'baz', 'qux', criteria)).thenReturn({ execute });

            return instance.removeOne(documentId)
                .then(actual => expect(actual).to.deep.equal(expected));
        });

        it('fails if an unexpected error is thrown', () => {
            const documentId = 'foo';
            const criteria = `_id = "${documentId}"`;
            const instance = collection('bar', 'baz', 'qux');
            const error = new Error('bazqux');

            td.when(execute()).thenReject(error);
            td.when(collectionRemove('bar', 'baz', 'qux', criteria)).thenReturn({ execute });

            return instance.removeOne(documentId)
                .then(() => expect.fail())
                .catch(err => expect(err).to.deep.equal(error));
        });
    });

    context('dropIndex()', () => {
        it('does not accept an invalid index name', () => {
            return collection().dropIndex()
                .then(() => expect.fail())
                .catch(err => expect(err.message).to.equal('Invalid index name.'));
        });

        it('accepts valid index name', () => {
            const getName = td.function();
            const schema = { getName };
            const instance = collection('bar', schema, 'qux');

            td.when(getName()).thenReturn('baz');
            td.when(execute()).thenResolve(true);
            td.when(sqlExecute('bar', 'drop_collection_index', [{ name: 'index', schema: 'baz', collection: 'qux' }], 'mysqlx')).thenReturn({ execute });

            return instance.dropIndex('index')
                .then(actual => expect(actual).to.be.true);
        });
    });

    context('createIndex()', () => {
        it('does not accept an invalid index name', () => {
            return collection().createIndex()
                .then(() => expect.fail())
                .catch(err => expect(err.message).to.equal('Invalid index name.'));
        });

        it('accepts a valid index name and valid index definition', () => {
            const getName = td.function();
            const schema = { getName };
            const instance = collection('bar', schema, 'qux');

            const args = [{
                name: 'index',
                schema: 'baz',
                collection: 'qux',
                unique: false,
                type: 'INDEX',
                constraint: [ { required: false, type: 'TINYINT', member: '$.age' } ]
            }];

            const index = {
                fields: [{
                    field: '$.age',
                    type: 'TINYINT'
                }]
            };

            td.when(getName()).thenReturn('baz');
            td.when(execute()).thenResolve(true);
            td.when(sqlExecute('bar', 'create_collection_index', args, 'mysqlx')).thenReturn({ execute });

            return instance.createIndex('index', index)
                .then(actual => expect(actual).to.be.true);
        });

        it('does not accept an index definition without valid field list', () => {
            return collection().createIndex('index', {})
                .then(() => expect.fail())
                .catch(err => expect(err.message).to.equal('Invalid index definition.'));
        });

        it('does not accept an index definition with empty field list', () => {
            return collection().createIndex('index', { fields: [] })
                .then(() => expect.fail())
                .catch(err => expect(err.message).to.equal('Invalid index definition.'));
        });

        it('does not accept an index definition with invalid field definition', () => {
            const index = {
                fields: [{
                    field: null,
                    type: null
                }]
            };

            return collection().createIndex('index', index)
                .then(() => expect.fail())
                .catch(err => expect(err.message).to.equal('Invalid index definition.'));
        });

        it('does not accept an index definition with any of the field definitions missing field', () => {
            const index = {
                fields: [{
                    type: 'TINYINT'
                }]
            };

            return collection().createIndex('index', index)
                .then(() => expect.fail())
                .catch(err => expect(err.message).to.equal('Invalid index definition.'));
        });

        it('does not accept an index definition with any of the field definitions missing type', () => {
            const index = {
                fields: [{
                    field: '$.age'
                }]
            };

            return collection().createIndex('index', index)
                .then(() => expect.fail())
                .catch(err => expect(err.message).to.equal('Invalid index definition.'));
        });

        it('does not allow unique option to be true in the index definition', () => {
            const index = {
                fields: [{
                    field: '$.age',
                    type: 'INT'
                }],
                unique: true
            };

            return collection().createIndex('index', index)
                .then(() => expect.fail())
                .catch(err => expect(err.message).to.equal('Unique indexes are currently not supported.'));
        });
    });
});
