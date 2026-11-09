# Burpee seed catalog

The November 9, 2026 snapshot covers Burpee’s public seed-only listing and the vegetable, herb, annual flower, and perennial flower categories. Products sold as both seeds and plants appear once. Pack sizes and organic packaging options do not create separate varieties. This is a reference snapshot, not a live stock or price feed.

## Find a variety

In **Add planting**, choose a **Seed category**, then a **Plant type**, then a variety. For example, choose **Vegetables → Tomato**. Alternatively, search across all categories: **sungold**, **sun gold**, and **sun gold tomatoes** find the same existing Sungold preset.

Search results appear as selectable cards directly below the filters, with six choices per page and **Previous** / **Next** controls to reach every match. Plant-type shortcuts and **Browse all varieties** also open the cards. Searching clears category and plant-type filters; choosing a category or plant type clears the previous search. **Clear filters** resets browsing.

New plantings start with **No variety selected**. Click a matching card to select it and reveal the planting details, then use **Add to my garden** to save. Enter in the search field focuses the first matching card without submitting the form. If you search again after selecting a variety or while editing a planting, choose a result or explicitly **Keep current variety** before saving.

Open **Burpee growing details** to see available product facts, including sun, lifecycle, sowing method, mature size, vegetable subtype, maturity days, growing zones, and bloom season. The reference date and product link are included. Facts absent from Burpee’s page remain absent.

## Timing and saved plantings

- Existing preset IDs, maturity values, and carefully written growing notes remain available. Saved planting records are not rewritten when the catalog expands.
- New vegetables use Burpee’s listed maturity days where supplied. Direct-sown maturity counts from several true leaves, with an editable 14-day allowance; indoor-started vegetable maturity counts from transplanting. Herb maturity uses an explicitly editable sowing-based planning anchor.
- New flower entries use Burpee’s bloom season, where available. They do not invent a sow-to-bloom countdown. Perennial seasons describe established plants and do not promise first-year flowers.
- Missing maturity values stay at zero. Enter a seed-packet value to create a countdown.
- Initial calendar dates reuse an existing crop-level planning profile where one exists. Otherwise, generic indoor starts use a six-week seedling allowance and an outdoor date two weeks after the configured spring frost date. Generic direct sowing starts at that frost date. These are editable placeholders, not Burpee’s cultivar-specific sowing instructions. Check the packet for planting dates, depth, germination conditions, thinning, and pretreatment.
- Watermelon and melon seeds remain in the vegetable seed picker, even when Burpee places a product under Fruits. Their planting records retain the app’s Fruit type. Other fruit-only seed products are recorded as out of scope in the snapshot summary.
- Newly added lettuce presets are also available for indoor lettuce rotations and backups.

## Data and verification

- `burpee-seed-data.js` contains factual attributes, product handles, category names, and coverage totals. Descriptions, prices, reviews, and images are not republished.
- `burpee-catalog.js` maps the facts to presets while preserving the original preset IDs and defaults.
- `seed-picker.js` supplies category, plant-type, and normalized search filtering.
- `burpee-catalog.test.js` checks complete inventory coverage, unique product links, valid schedules and backups, unknown timing, lettuce rotation support, and search/filter behavior.

For a future refresh, inventory the public **Seed** results at [Burpee’s seed collection](https://www.burpee.com/collections/all-seeds?filter.v.m.burpee.propagule-type=Seed), including all listing pages. Read each linked product’s facts and verify category membership against Burpee’s four category directories. Use the product listing title when breadcrumbs contain a generic category such as “Annuals.” Preserve stable product handles and review additions, removals, and changed facts before replacing the snapshot.

The generator accepts the captured listing, product details, and category directories:

```sh
node scripts/build-burpee-catalog.mjs listing.json details.json collections.json
npm test
```

It rejects missing product details and duplicate listing URLs. The snapshot summary accounts for both included products and fruit-only products outside the requested categories. Review the resulting coverage totals and update the snapshot date and inventory assertion for a new reference date.
