# Third-Party Notices

## marmelab/atomic-crm

`src/components/admin/` (87 components) and `src/components/ui/` (35 shadcn/ui
primitives), together with `src/lib/utils.ts`, `src/lib/field.type.ts` and
`src/hooks/use-mobile.ts`, are ported from **Atomic CRM** by Marmelab.

- Source: https://github.com/marmelab/atomic-crm
- License: MIT

```
The MIT License (MIT)

Copyright (c) 2024-present, Francois Zaninotto, Marmelab

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

## react-admin (ra-core) and shadcn/ui

- `ra-core`, `ra-supabase-core`, `ra-i18n-polyglot` are MIT (Marmelab).
  No `@react-admin/*` enterprise packages are used.
- shadcn/ui primitives are MIT.

## Deliberately NOT used

**Twenty CRM** (https://github.com/twentyhq/twenty) is licensed **AGPL-3.0**.
No code from it has been copied into this repository. It is referenced only as
a UX study; copying its source would impose AGPL obligations on this codebase.

## Written in-house

`src/i18n/he.js` (Hebrew translation pack for react-admin) is original work for
this project, since react-admin ships English and French only.
