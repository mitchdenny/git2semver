module.exports = (policy) => {
    policy.useMainline('major:', 'minor:', 'patch:');
    policy.useFormatter((result) => `##vso[build.updatebuildnumber]${result.version}`);
};