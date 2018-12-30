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
        this.result = latestTag;
        this.formatters = {
            "default": (result) => result.version,
            "majorminorpatch": (result) => result.version,
            "majorminorpatch-pipelines": (result) => `##vso[build.updatebuildnumber]${result.version}`
        };
        this.selectedFormatter = this.formatters.default;
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
        let output = this.result;

        if (this.incrementMajorWhenPredicate != null && this.incrementMajorWhenPredicate(commit)) {
            output = semver.inc(output, 'major');
        } else if (this.incrementMinorWhenPredicate != null && this.incrementMinorWhenPredicate(commit)) {
            output = semver.inc(output, 'minor');
        } else if (this.incrementPatchWhenPredicate != null && this.incrementPatchWhenPredicate(commit)) {
            output = semver.inc(output, 'patch');
        }

        this.result = semver.parse(output);
    }

    useFormatter(formatter) {
        if (typeof(formatter) === "function") {
            this.selectedFormatter = formatter;
        } else {
            this.selectedFormatter = this.formatters[formatter];
        }
    }

    applyFormat () {
        return this.selectedFormatter(this.result);
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

        this.latestTag = latestTag == null ? semver.parse('0.0.0') : latestTag;
    }

    async applyConfigurationInRepositoryOrUseDefault() {
        const configurationFilePathByConvention = path.resolve(this.repositoryPath, 'git2semver.config.js');
        try {
            await accessAsync(configurationFilePathByConvention, fs.constants.R_OK);
            this.configuration = require(configurationFilePathByConvention);
        } catch {
            this.configuration = (policy) => {
                policy.useMainline('major:', 'minor:', 'patch:');
            };
        }
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
    async getVersion(repositoryPath, configuration, formatter) {
        
        const repository = new Repository(repositoryPath);
        const repositoryRootPath = await repository.getRepositoryRootPath();

        const latestTag = await repository.getLatestVersionTag();

        const commits = await repository.getCommitsSinceTag(latestTag);

        const policyLoader = new PolicyLoader(repositoryRootPath, configuration, latestTag);
        const policy = await policyLoader.getPolicy();
        
        if (formatter != "default" && formatter != undefined) {
            policy.useFormatter(formatter);
        }

        for (let index = 0; index < commits.length; index++) {
            const commit = commits[index];
            policy.applyCommit(commit);
        }

        const output = policy.applyFormat();
        return output;
    }
}