const git2semver = require('../src/index');
const repositoryPath = '..';

(async function() {
    const version = await git2semver.getVersion(repositoryPath);
    console.log(version);
})();