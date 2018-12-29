#!/usr/bin/env node
const git2semver = require('./index');
const program = require('commander');
const packageMetadata = require('../package.json');

program
    .name('git2semver')
    .version(packageMetadata.version)
    .usage('[options]')
    .option('-f, --formatter <formatter>', 'Use formatter')
    .option('-r, --repository <path>', 'Path to local repository')
    .option('-c, --configuration <path>', 'Path to configuration object')
    .parse(process.argv);

let formatter = 'default';
if (program.formatter) {
    formatter = program.formatter;
}

let repositoryPath = '.';
if (program.repository) {
    repositoryPath = program.repository;
}

let configuration = null;
if (program.configuration) {
    configuration = require(program.configuration);
}

(async function() {
    const version = await git2semver.getVersion(repositoryPath, configuration, formatter);
    console.log(version);})();