const detector = require('../src/index');
const repositoryPath = 'C:\\Code\\tag-work';

const policy = require('./policies/mainline');

detector.detectVersion(
    repositoryPath,
    policy
).then(
    (version) => console.log(version)
);