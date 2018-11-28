const {spawn} = require('child_process');
const semver = require('semver');
const fs = require('fs');
const path = require('path');
const {promisify} = require('util');
const accessAsync = promisify(fs.access);

class Commit {
    constructor(hash, message, branch) {
        this.hash = hash;
        this.message = message;
        this.branch = branch;
    }
}

class Command {
    constructor(command, workingDirectory) {
        this.command = command;
        this.workingDirectory = workingDirectory;
    }

    getStdout() {
        let promise = new Promise((resolve, reject) => {
            const childProcess = spawn(this.command, {
                shell: true,
                cwd: this.workingDirectory
            });
    
            let output = ""
            childProcess.stdout.on('data', (chunk) => {
                output = output + chunk;
            });
    
            childProcess.once('exit', (code, signal) => {
               console.log(`STDOUT FROM GIT2SEMVER: ${output}`);
                if (code != 0) {
                    reject('Non-zero exit');
                } else {
                    resolve(output);
                }
            });
        });
    
        return promise;
    }
}


class Repository {
    constructor(repositoryPath) {
        this.repositoryPath = repositoryPath;
    }

    async getLatestVersionTag() {
        try {
            // This command returns a list of all tags sorted in date order (descending).
            const command = new Command('git for-each-ref --sort=-taggerdate --format="%(refname:short)" refs/tags', this.repositoryPath);
            const output = await command.getStdout();

            const lines = output.split('\n');

            for (let index = 0; index < lines.length; index++) {
                const candidate = lines[index];
                const version = semver.parse(candidate);
        
                if (version != null) {
                    return version;
                    break;
                }
            }
            
        } catch {
            return null;
        }
    }
    
    async getBranch() {
        const command = new Command(
            'git rev-parse --abbrev-ref HEAD',
            this.repositoryPath
        );

        const output = await command.getStdout();
        const lines = output.split('\n');
        const branch = lines[0];
        
        return branch;
    }

    async getCommitsSinceTag(tag) {
        const command = new Command(
            tag == null ? 'git log --format="%H %s"' : `git log ${tag}..HEAD --format="%H %s"`,
            this.repositoryPath
        );

        const output = await command.getStdout();
        const lines = output.split('\n');

        const branch = await this.getBranch();
    
        const commits = [];
        for (let index = lines.length; index >= 0; index--) {
            const line = lines[index];
            
            if (!(line == '' || line == null || line == undefined)) {
                const hash = line.substring(0, 40);
                const message = line.substring(41);
                const commit = new Commit(hash, message, branch);
                commits.push(commit);
            }
        }
    
        return commits;
    }

    async getRepositoryRootPath() {

        if (this.repositoryRootPath == undefined) {
            const command = new Command('git rev-parse --show-toplevel', this.repositoryPath);
            const output = await command.getStdout();
            this.repositoryRootPath = output.split('\n')[0];    
        }

        return this.repositoryRootPath;
    }
}

class Policy {
    constructor(latestTag) {
        this.result = latestTag.version;
    }

    incrementMajorWhen(predicate) {
        this.incrementMajorWhenPredicate = predicate;
    }

    incrementMinorWhen(predicate) {
        this.incrementMinorWhenPredicate = predicate;
    }

    incrementPatchWhen(predicate) {
        this.incrementPatchWhenPredicate = predicate;
    }

    useMainline(majorCommitMessagePrefix, minorCommitMessagePrefix, patchCommitMessagePrefix) {
        this.clear();

        this.incrementMajorWhen((commit) => commit.message.toLowerCase().startsWith(majorCommitMessagePrefix));
        this.incrementMinorWhen((commit) => commit.message.toLowerCase().startsWith(minorCommitMessagePrefix));
        this.incrementPatchWhen((commit) => commit.message.toLowerCase().startsWith(patchCommitMessagePrefix));
    }

    applyCommit (commit) {
        if (this.incrementMajorWhenPredicate != null && this.incrementMajorWhenPredicate(commit)) {
            this.result = semver.inc(this.result, 'major');
        } else if (this.incrementMinorWhenPredicate != null && this.incrementMinorWhenPredicate(commit)) {
            this.result = semver.inc(this.result, 'minor');
        } else if (this.incrementPatchWhenPredicate != null && this.incrementPatchWhenPredicate(commit)) {
            this.result = semver.inc(this.result, 'patch');
        }
    }

    clear() {
        this.incrementMajorWhenPredicate = null;
        this.incrementMinorWhenPredicate = null;
        this.incrementPatchWhenPredicate = null;
    }
}

class PolicyLoader {
    constructor(repositoryPath, configuration, latestTag) {
        this.repositoryPath = repositoryPath;
        this.configuration = configuration;
        this.latestTag = latestTag;
    }

    async applyConfigurationInRepositoryOrUseDefault() {
        const configurationFilePathByConvention = path.resolve(this.repositoryPath, 'git2semver.config.js');
        try {
            await accessAsync(configurationFilePathByConvention, fs.constants.R_OK);
        } catch {
            this.configuration = (policy) => {
                policy.useMainline();
            };
        }

        this.configuration = require(configurationFilePathByConvention);
    }

    async getPolicy() {
        const policy = new Policy(this.latestTag);

        if (this.configuration instanceof Function) {
            this.configuration(policy);
        } else if (this.configuration == null || this.configuration == undefined) {
            await this.applyConfigurationInRepositoryOrUseDefault();
            this.configuration(policy);
        } else if (this.configuration.toLowerCase() == "mainline") {
            policy.useMainline();
        } 

        return policy;
    }
}

module.exports = {
    async getVersion(repositoryPath, configuration) {
        const repository = new Repository(repositoryPath);
        const repositoryRootPath = await repository.getRepositoryRootPath();

        const latestTag = await repository.getLatestVersionTag();
        console.log(latestTag);

        const commits = await repository.getCommitsSinceTag(latestTag);

        const policyLoader = new PolicyLoader(repositoryRootPath, configuration, latestTag);
        const policy = await policyLoader.getPolicy();

        for (let index = 0; index < commits.length; index++) {
            const commit = commits[index];
            policy.applyCommit(commit);
        }

        return policy.result; 
    }
}