# React Interview Preparation: Large Data, API Design, and Performance

A practical system-design guide for senior and intermediate React interviews. The examples use an enterprise employee dashboard with React, a REST API (illustrated with Spring Boot), and PostgreSQL. The principles also apply to product catalogs, audit logs, customer directories, and other data-heavy interfaces.

## Contents

1. [Scenario and requirements](#scenario-and-requirements)
2. [Why not load all 50,000 records?](#why-not-load-all-50000-records)
3. [Pagination, infinite scrolling, and virtualization](#pagination-infinite-scrolling-and-virtualization)
4. [Where filtering and sorting belong](#where-filtering-and-sorting-belong)
5. [API contract and request lifecycle](#api-contract-and-request-lifecycle)
6. [React implementation: paginated employee list](#react-implementation-paginated-employee-list)
7. [Debouncing search and cancelling obsolete requests](#debouncing-search-and-cancelling-obsolete-requests)
8. [Caching and request management with TanStack Query](#caching-and-request-management-with-tanstack-query)
9. [Offset and keyset pagination](#offset-and-keyset-pagination)
10. [Database indexing and query safety](#database-indexing-and-query-safety)
11. [Large exports](#large-exports)
12. [Security and multi-tenancy](#security-and-multi-tenancy)
13. [Putting the architecture together](#putting-the-architecture-together)
14. [Failure scenarios and trade-offs](#failure-scenarios-and-trade-offs)
15. [Interview questions with answer guidance](#interview-questions-with-answer-guidance)
16. [Practical interview exercises](#practical-interview-exercises)
17. [A structured system-design answer](#a-structured-system-design-answer)
18. [Quick revision](#quick-revision)

## Scenario and requirements

Assume an employee-management dashboard needs to display, search, filter, sort, and export 50,000 employee records.

Before choosing technologies, clarify:

- How many records can a user see at a time?
- Are filters applied to the whole dataset or only the visible page?
- Must users jump to a specific page or record?
- Does the data change frequently?
- Are there tenant, role, or row-level access restrictions?
- How large can exports become?
- What response-time target and API rate limits apply?

These questions affect whether to use offset or cursor pagination, whether to cache results, and where each operation should run.

### Example architecture

```text
User
 |
 v
React dashboard
 |  search, filters, sort, page/cursor
 v
Query/cache layer (optional, e.g. TanStack Query)
 |
 v
REST API
 |
 v
Application service + authorization
 |
 v
Repository / parameterized database query
 |
 v
PostgreSQL
```

The browser should normally receive only the records needed for the current view. The server is responsible for enforcing access rules and applying large-dataset filters and ordering.

## Why not load all 50,000 records?

Sending every row to the browser can increase:

- Initial response size and network transfer time.
- JSON parsing and memory use.
- Client-side filtering and sorting work.
- DOM creation and React reconciliation cost.
- Time before a user can interact with the page.

The practical issue is often not merely storing 50,000 JavaScript objects. Rendering tens of thousands of row elements can make scrolling and interaction sluggish.

For example, fetching 50 rows per request means a page displays a small slice while the server handles the full result set:

```text
50,000 database rows
        |
        | server-side filter + sort + page
        v
50 rows sent to browser
        |
        v
React renders the current view
```

Small, stable reference lists (such as a few dozen departments) may be reasonable to fetch once and cache. Large, frequently changing, or access-controlled records are better queried on demand.

## Pagination, infinite scrolling, and virtualization

These techniques solve related but different problems.

### Server-side pagination

Pagination partitions the result set into pages, often with a page number and page size:

```text
Page 0 -> rows 1-50
Page 1 -> rows 51-100
Page 2 -> rows 101-150
```

**Good fit:** administrative tables, reports, audit logs, and workflows where users need page controls or a stable result count.

**Benefits**

- Bounded response sizes.
- Direct page navigation and clear state.
- Easier to pair with server-side sorting and filters.

**Trade-offs**

- Users navigate between pages.
- Offset pagination can become expensive for deep pages.
- Data changing between requests can shift page boundaries.

### Infinite scrolling

Infinite scrolling appends another page when the user approaches the end of the current list:

```text
Fetch first page
      |
User approaches bottom
      |
Fetch next cursor/page
      |
Append items and continue
```

**Good fit:** social feeds, activity streams, and discovery experiences where continuous browsing matters more than jumping to a page.

**Trade-offs:** direct navigation is harder, scroll restoration needs care, and an unbounded client-side list can consume increasing memory. Keep accumulated data bounded or virtualize it.

### Virtual scrolling (windowing)

Virtual scrolling limits how many rows exist in the DOM at one time. The UI renders visible rows plus a small overscan area, while spacer dimensions preserve the overall scroll height:

```text
Dataset in memory: 50,000 rows
Viewport can show:       20 rows
Overscan buffer:          8 rows
DOM rows mounted: about  28 rows, not 50,000
```

Virtualization reduces rendering and DOM costs. It does **not** reduce the amount of data already fetched or held in memory.

| Technique | Controls |
| --- | --- |
| Server-side pagination | How much data is fetched per request |
| Infinite scrolling | When subsequent pages are requested |
| Virtual scrolling | How many rows are rendered in the DOM |

These approaches can be combined. For example, an activity feed might use cursor pagination to fetch chunks and virtualization to render only a window of the loaded items.

When using a virtualization library, check the installed version's API and test accessibility, dynamic row heights, keyboard navigation, and screen-reader behavior.

## Where filtering and sorting belong

### Client-side filtering

Client-side filtering is suitable when the complete dataset is already small and available in the browser, the operation is inexpensive, and the user is allowed to see every record being filtered.

```js
const filteredEmployees = employees.filter((employee) =>
  employee.name.toLowerCase().includes(search.toLowerCase()),
);
```

It is not a security boundary: hiding rows in React does not prevent a user from accessing data that was already downloaded.

### Server-side filtering

For large datasets, send filter and sort criteria to the server so that PostgreSQL can process them before returning a page:

```http
GET /api/v1/employees?search=Gautam&department=IT&status=ACTIVE&sort=name,asc&page=0&size=50
```

The server should:

1. Authenticate the request.
2. Apply tenant and authorization constraints.
3. Validate filter and sort inputs.
4. Execute a parameterized query with deterministic ordering.
5. Return the requested page and pagination metadata.

Example response:

```json
{
  "items": [
    { "id": "emp-104", "name": "Gautam Rao", "department": "IT", "status": "ACTIVE" }
  ],
  "page": 0,
  "size": 50,
  "totalElements": 1,
  "totalPages": 1,
  "sort": ["name,asc"]
}
```

The exact response shape is an API design choice. Keep it consistent and document whether page indexes are zero-based or one-based.

### Sorting across pages

Apply sorting on the server before pagination. Sorting only the currently loaded page does not produce a globally sorted dataset.

Use a stable tie-breaker in the ordering. If employees are sorted by a non-unique name, use the unique ID as a second key:

```sql
ORDER BY name ASC, id ASC
```

This makes ordering deterministic when multiple rows share the same name.

## API contract and request lifecycle

A page request should include every state value that changes the result:

```text
search + department + status + sort + page + pageSize
                         |
                         v
                 API request parameters
                         |
                         v
       server authorization + validation + query
                         |
                         v
       { items, page, size, totalElements, ... }
```

When search, filters, or sort order change, reset the page/cursor to the beginning. Otherwise, a user can remain on a page that no longer exists in the filtered result.

## React implementation: paginated employee list

This example shows basic request state, error reporting, page controls, and cancellation of obsolete requests. It assumes the API returns the `items` and pagination fields described above.

```jsx
import { useEffect, useState } from "react";

const PAGE_SIZE = 50;

export function EmployeeList() {
  const [employees, setEmployees] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadPage() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          page: String(page),
          size: String(PAGE_SIZE),
        });

        const response = await fetch(`/api/v1/employees?${params}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Employee request failed (${response.status})`);
        }

        const result = await response.json();
        setEmployees(result.items);
        setTotalPages(result.totalPages);
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setError(requestError);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadPage();
    return () => controller.abort();
  }, [page]);

  return (
    <section aria-labelledby="employee-heading">
      <h2 id="employee-heading">Employees</h2>

      {error && <p role="alert">{error.message}</p>}
      {loading && <p role="status">Loading employees...</p>}

      {!loading && !error && (
        <ul>
          {employees.map((employee) => (
            <li key={employee.id}>{employee.name}</li>
          ))}
        </ul>
      )}

      <nav aria-label="Employee pages">
        <button
          type="button"
          disabled={loading || page === 0}
          onClick={() => setPage((current) => current - 1)}
        >
          Previous
        </button>
        <span>
          Page {totalPages === 0 ? 0 : page + 1} of {totalPages}
        </span>
        <button
          type="button"
          disabled={loading || page + 1 >= totalPages}
          onClick={() => setPage((current) => current + 1)}
        >
          Next
        </button>
      </nav>
    </section>
  );
}
```

Production considerations:

- A production component should distinguish initial loading from background refetching if existing rows should remain visible.
- Include filters and sort state in the request and in the effect dependencies.
- Reset pagination when those inputs change.
- Consider keeping prior data visible during page transitions to reduce layout flicker.
- Handle an empty result set and a page made invalid by concurrent data changes.
- Keep error messages useful to users while logging diagnostic details through the application's standard logging/monitoring path.

## Debouncing search and cancelling obsolete requests

### Debouncing

Debouncing delays work until input has remained unchanged for a specified interval. If a user types `G`, `Ga`, `Gau`, and `Gautam` quickly, a 400 ms debounce can produce one search request after the final keystroke instead of one request per character.

```text
Keystrokes: G - Ga - Gau - Gautam
Timer:       reset reset reset ... wait 400 ms
Request:                              search "Gautam"
```

A reusable hook:

```jsx
import { useEffect, useState } from "react";

export function useDebouncedValue(value, delay = 400) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timerId = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timerId);
  }, [value, delay]);

  return debouncedValue;
}
```

The controlled input should update immediately; only the network query waits:

```jsx
function EmployeeSearch({ onSearch }) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);

  useEffect(() => {
    onSearch(debouncedSearch);
  }, [debouncedSearch, onSearch]);

  return (
    <label>
      Search employees
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
    </label>
  );
}
```

In a real component, stabilize `onSearch` or keep the query logic in the component to avoid unnecessary effect executions.

Debouncing is different from throttling:

- **Debounce:** run after a quiet period; useful for search input.
- **Throttle:** run at most once per time window; useful for scroll or resize handlers.

### Abort outdated requests

Debouncing reduces how many requests start. It does not prevent an already-started, slower request from returning after a newer one. Use `AbortController` to cancel work that is no longer relevant:

```jsx
useEffect(() => {
  if (debouncedSearch.trim().length < 2) {
    setEmployees([]);
    return undefined;
  }

  const controller = new AbortController();

  async function searchEmployees() {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        search: debouncedSearch.trim(),
        page: "0",
        size: "50",
      });

      const response = await fetch(`/api/v1/employees?${params}`, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Search failed (${response.status})`);
      }

      const result = await response.json();
      setEmployees(result.items);
    } catch (requestError) {
      if (requestError.name !== "AbortError") {
        setError(requestError);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }

  searchEmployees();
  return () => controller.abort();
}, [debouncedSearch]);
```

Aborting a client request does not guarantee that the server or database instantly stops work already in progress. It does prevent stale client responses from being applied when cancellation is handled correctly.

## Caching and request management with TanStack Query

A query cache can help with request deduplication, loading/error states, retries, background refreshes, and cached page data. It does not replace backend authorization or API design.

Example using TanStack Query's object API:

```jsx
import { useQuery } from "@tanstack/react-query";

function useEmployees({ search, department, page, sort }) {
  return useQuery({
    queryKey: ["employees", { search, department, page, sort }],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({
        page: String(page),
        size: "50",
        sort,
      });

      if (search) params.set("search", search);
      if (department) params.set("department", department);

      const response = await fetch(`/api/v1/employees?${params}`, {
        signal,
      });

      if (!response.ok) {
        throw new Error(`Employee request failed (${response.status})`);
      }

      return response.json();
    },
    staleTime: 30_000,
  });
}
```

The query key includes every parameter that changes the response. Omitting a filter or page from the key can cause unrelated results to share a cache entry. TanStack Query passes an abort signal to the query function; forward it to `fetch` if cancellation is desired.

Example usage:

```jsx
const { data, isPending, isError, error } = useEmployees({
  search,
  department,
  page,
  sort,
});
```

Exact status property names and optional pagination behaviors can differ by TanStack Query version. Check the version used by the application.

## Offset and keyset pagination

### Offset pagination

Offset pagination is easy to understand and supports page-number navigation:

```sql
SELECT id, name, department, status
FROM employees
WHERE tenant_id = :tenant_id
ORDER BY name ASC, id ASC
LIMIT :page_size
OFFSET :offset;
```

`offset` is often computed as `page * page_size`. Deep offsets can be inefficient because the database may need to walk past many rows. Concurrent inserts/deletes can also shift rows between page requests.

### Keyset (cursor) pagination

Keyset pagination uses the last row's sort values as a cursor:

```sql
SELECT id, name, department, status
FROM employees
WHERE tenant_id = :tenant_id
  AND (name, id) > (:last_name, :last_id)
ORDER BY name ASC, id ASC
LIMIT :page_size;
```

The cursor includes a unique tie-breaker (`id`) so records with equal names are ordered consistently. Cursor pagination is often better for deep traversal and feeds, but it does not naturally support jumping directly to page 200.

```text
Offset: request page 200 -> skip many earlier rows
Cursor: request after (lastName, lastId) -> continue from stable position
```

Choose based on product needs: page-number navigation often favors offset pagination for moderate depth; continuous browsing or deep scans often favor cursors.

## Database indexing and query safety

Index common filters and sort patterns based on actual query plans and workload measurements. Example candidate indexes:

```sql
CREATE INDEX idx_employees_tenant_department
  ON employees (tenant_id, department);

CREATE INDEX idx_employees_tenant_status
  ON employees (tenant_id, status);

CREATE INDEX idx_employees_tenant_name_id
  ON employees (tenant_id, name, id);
```

These are examples, not universal recommendations. Indexes add storage and write costs. Use query plans (`EXPLAIN ANALYZE` where appropriate) and representative production-like data before deciding.

Always parameterize values. Sort column names generally cannot be passed as ordinary SQL value parameters, so map client-requested sort keys through an explicit allowlist:

```text
"name"       -> SQL column employees.name
"department" -> SQL column employees.department
anything else -> reject or use a documented default
```

Validate page sizes and impose a maximum. Validate direction (`ASC`/`DESC`) and filter values. Never concatenate untrusted input into SQL.

## Large exports

Avoid retrieving a massive dataset into React just to generate an export in the browser. A scalable workflow is:

```text
User requests export with filters
              |
              v
API validates authorization and query
              |
              v
Background job reads records in batches
              |
              v
Generate CSV/XLSX in durable storage
              |
              v
Expose job status and authorized download
```

Possible API shape:

```http
POST /api/v1/employee-exports
GET  /api/v1/employee-exports/{jobId}
GET  /api/v1/employee-exports/{jobId}/download
```

The job status can be `QUEUED`, `RUNNING`, `COMPLETED`, or `FAILED`. The server must re-check access when creating and downloading the export. Define expiration and cleanup for generated files.

For modest exports, a synchronous streaming endpoint may be sufficient. Choose based on file size, generation time, infrastructure limits, and user expectations.

## Security and multi-tenancy

The backend is the security boundary. Do not rely on React to hide unauthorized rows or filter data.

- Authenticate every protected request.
- Enforce tenant and role restrictions in the server query, not only in UI state.
- Validate page size, sort fields, directions, and filter values.
- Use parameterized database queries.
- Avoid returning fields the UI does not need.
- Apply authorization to export creation, status checks, and downloads.
- Consider audit logging for sensitive searches and exports.

For multi-tenant data, a query should scope results by the authenticated tenant before applying user-supplied filters:

```sql
SELECT id, name, department, status
FROM employees
WHERE tenant_id = :authenticated_tenant_id
  AND (:department IS NULL OR department = :department)
ORDER BY name ASC, id ASC
LIMIT :page_size;
```

The tenant ID should come from trusted authentication context, not a freely chosen query parameter.

## Putting the architecture together

```text
                         React UI
          search | filters | sort | pagination
                            |
                 debounce changing search
                            |
              query cache + request cancellation
                            |
                 GET page/filter/sort request
                            v
                   Spring Boot REST API
          authenticate -> authorize -> validate
                            |
                 Employee service/repository
                            |
            parameterized filter + stable ordering
                            |
                       PostgreSQL
           indexes chosen from measured query patterns
                            |
                  paginated JSON response
                            v
          React renders current page (virtualize if needed)
```

Recommended baseline for an enterprise employee dashboard:

| Area | Starting approach |
| --- | --- |
| Fetching | Server-side pagination |
| Search | Debounced server-side search |
| Filtering and sorting | Server-side for the full dataset |
| Request lifecycle | Abort stale requests or use a query library |
| Rendering | Render one page; virtualize if the visible list is still large |
| Deep navigation | Consider keyset pagination |
| Export | Server-side job for large files |
| Security | Enforce authorization and tenant scope in the backend |

## Failure scenarios and trade-offs

| Scenario | Risk | Response |
| --- | --- | --- |
| User types a new search before old response returns | Stale results replace current results | Abort obsolete requests and associate state with the current query |
| Filter changes while user is on a deep page | Empty page even though matches exist | Reset page/cursor when filters or sort change |
| Dataset changes between offset-page requests | Duplicates or skipped rows | Stable ordering; use cursors where consistency and deep traversal matter |
| API returns an error | Blank UI or silent failure | Show an actionable error state; allow retry where appropriate |
| One concurrent request fails | `Promise.all()` rejects | Decide whether all-or-nothing or partial results are required; use `allSettled()` for per-item outcomes |
| User requests export too large for request timeout | Failed request or memory pressure | Queue a background job and expose progress/status |
| Client requests huge page size | Database and server resource pressure | Validate and cap size server-side |
| UI hides records without backend authorization | Data exposure through API or devtools | Enforce authorization in every server query and endpoint |
| Virtualized rows are inaccessible | Keyboard/screen-reader usability problems | Test accessibility and provide appropriate semantics and focus behavior |

## Interview questions with answer guidance

1. **Why avoid loading all 50,000 records?**  
   Discuss network transfer, parsing, memory, client-side work, render cost, and whether the browser needs the whole dataset.
2. **Pagination vs. infinite scrolling?**  
   Relate the choice to the user's task: page navigation and reporting versus continuous discovery.
3. **What does virtualization solve?**  
   DOM/render work, not data fetching or server query cost.
4. **Can virtualization replace pagination?**  
   Not by itself. It limits rendered nodes; pagination limits fetched records.
5. **Where should large-dataset filtering happen?**  
   Usually on the server/database, with authorization enforced there.
6. **What is debouncing? How is it different from throttling?**  
   Debounce waits for quiet; throttle limits execution frequency.
7. **How do you prevent stale search results?**  
   Cancel obsolete requests and ensure results correspond to the current query key/state.
8. **What does `AbortController` guarantee?**  
   It signals cancellation to supported client operations; it does not guarantee all server-side work instantly stops.
9. **Why use a query cache?**  
   Explain cache keys, deduplication, freshness, retries, background updates, and invalidation.
10. **Offset vs. keyset pagination?**  
    Compare page-number UX and simplicity with deep-query performance and cursor-based navigation.
11. **How should sorting work across pages?**  
    Sort on the server before pagination, with stable unique tie-breaking.
12. **How would you export a million records?**  
    Propose a server-side streaming or background job, batching, status reporting, secure download, and retention.
13. **How would you secure tenant data?**  
    Derive tenant scope from trusted auth context and apply it in every relevant query and export.
14. **How do you handle partial failures from several API calls?**  
    Decide whether the UI needs all-or-nothing results (`Promise.all`) or each result independently (`Promise.allSettled`).
15. **How do you prevent duplicate API calls?**  
    Use stable query keys/caching, deduplication, debounce where appropriate, and avoid effects with unstable dependencies.

## Practical interview exercises

### Exercise 1: Employee search API

Design an endpoint supporting name search, department/status filters, sorting, and pagination.

Be prepared to specify:

- Query parameters and response schema.
- Defaults and maximum page size.
- Validation and allowed sort fields.
- Stable ordering.
- Authorization and tenant scoping.
- Error responses and empty results.

### Exercise 2: Debounced search component

Build a search box that:

- Updates its controlled input immediately.
- Debounces network requests.
- Cancels outdated requests.
- Shows loading, empty, error, and result states.
- Resets pagination when the query changes.

### Exercise 3: Large table

Display 50,000 employees without creating 50,000 row elements.

Explain:

- Server-side page/cursor loading.
- Virtualization and overscan.
- Stable React keys.
- Keyboard and screen-reader behavior.
- How filters and sorting interact with the current page.

### Exercise 4: Duplicate request prevention

Use a query cache with a key containing search, filters, sort, page/cursor, and page size. Explain how stale time and invalidation affect freshness.

### Exercise 5: Large export

Design a background export with job creation, progress/status, retry or failure state, secure download, and cleanup policy.

## A structured system-design answer

Use this sequence to keep an interview answer clear:

1. **Clarify the user task.** Does this need direct page navigation, continuous browsing, or full export?
2. **State constraints.** Dataset size, update rate, access control, latency, request limits, and export size.
3. **Choose a data-fetching strategy.** Server pagination or cursors; explain why.
4. **Assign responsibilities.** React manages UI state; API validates and authorizes; database filters, sorts, and pages.
5. **Explain the rendering strategy.** Render one page; add virtualization if DOM size remains an issue.
6. **Handle interaction efficiently.** Debounce search, cancel stale client requests, cache by complete query state.
7. **Cover failure and security.** Errors, partial failures, retries, tenant scoping, input validation, and export authorization.
8. **Discuss trade-offs and scale.** Offset vs cursor, cache freshness, concurrency limits, and background exports.

### Example concise answer

> For an employee dashboard with 50,000 records, I would avoid fetching the full dataset by default. I would use server-side pagination, filtering, and sorting, returning a bounded page plus pagination metadata. Search input would be debounced, and obsolete client requests would be cancelled or ignored. A query cache can deduplicate and cache requests using a key that includes every filter, sort, and page value. React would render only the current page; if a loaded view still contains many rows, I would add accessible virtualization. The API would validate parameters and enforce tenant authorization before querying PostgreSQL with parameterized filters and stable ordering. I would consider keyset pagination for deep traversal and a background export job for large files.

## Quick revision

- **Fetch:** server-side pagination or cursors keep responses bounded.
- **Filter/sort:** apply to the full result set on the server when data is large.
- **Render:** pagination controls fetched data; virtualization controls mounted DOM rows.
- **Search:** debounce to reduce requests; cancel or disregard stale requests.
- **Cache:** include every result-defining input in the query key.
- **Async:** `for...of` plus `await` is sequential; `Promise.all()` is concurrent for independent work.
- **Database:** validate limits, parameterize values, whitelist sort columns, and measure indexes.
- **Security:** backend authorization and tenant constraints are mandatory; UI filtering is not access control.
- **Export:** large files usually belong in a server-side streaming or background-job workflow.
- **Interview quality:** explain why the design fits, its trade-offs, and how it fails—not only the library names.
