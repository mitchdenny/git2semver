#!/usr/bin/env node
const git2semver = require('./index');
const repositoryPath = '.';

(async function() {
    const version = await git2semver.getVersion(repositoryPath);
    console.log(version);
})();