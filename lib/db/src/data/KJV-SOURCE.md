# King James Version text source

`kjv.json` in this directory is the full King James Version Bible text (66 books,
1,189 chapters, 31,100 verses), used to seed the `verses` table.

The King James Version itself is in the public domain. This particular JSON
transcription/format comes from https://github.com/thiagobodruk/bible
(`json/en_kjv.json`), which is MIT-licensed:

```
MIT License

Copyright (c) 2024 Thiago Bodruk

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Book order in `kjv.json` matches the canonical order used by `rawBooks` in
`../seed.ts` exactly (verified against all 66 book names and chapter counts),
so the seed script zips the two arrays by index rather than matching by name.
