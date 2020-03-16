# definitions-parser

Extracted from [types-publisher](https://github.com/microsoft/types-publisher). Parts of the [publisher](../publisher) README describe functionality of this package, but since this was previously internal API, docs are sparse. Essentially, this package is responsible for

1. Downloading a copy of the DefinitelyTyped repository from GitHub (optional—a local copy can be used instead).
2. Reading all definitions from that repository, doing some analysis, and caching that data in the `data` directory.
3. Providing a programmatic API wrapper around that data.
