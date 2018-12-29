const assert = require('assert');
const git2semver = require('../src/index');
const path = require('path');

// Use this configuration tests to avoid automatically loading
// the one from the local Git repo.
const overrideConfiguration = (policy) => {
    policy.useMainline('major:', 'minor:', 'patch:');
}

describe('git2semver', () => {
    describe('#getVersion()', () => {
        it('should return a version starting with zero for this repository', async () => {
            const version = await git2semver.getVersion(__dirname, overrideConfiguration);
            assert.equal(version.startsWith('0.'), true);
        });
        it('should return a version that is not the default', async () => {
            const version = await git2semver.getVersion(__dirname, overrideConfiguration);
            assert.equal(version.startsWith('0.0.0'), false);
        });
    });
});