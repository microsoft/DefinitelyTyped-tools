module.exports = {
    client: {
        includes: ["src/queries/**"],
        service: {
            name: "github",
            url: "https://api.github.com/graphql",
            headers: {
                authorization: `Bearer ${
                    process.env["DT_BOT_AUTH_TOKEN"] ||
                    process.env["BOT_AUTH_TOKEN"] ||
                    process.env["AUTH_TOKEN"]
                }`,
                accept: "application/vnd.github.starfox-preview+json, application/vnd.github.bane-preview+json",
            },
        }
    }
};
