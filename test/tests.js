const assert = require('assert');
const git2semver = require('../src/index');
const path = require('path');

describe('git2semver', () => {
    describe('#getVersion()', () => {
        it('should return a version starting with zero for this repository', async () => {
            const version = await git2semver.getVersion(__dirname);
            assert.equal(version.startsWith('0.'), true);
        });
        it('should return a version that is not the default', async () => {
            const version = await git2semver.getVersion(__dirname);
            assert.equal(version.startsWith('0.0.0'), false);
        });
    });
});