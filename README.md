# Sponsor logos

Drop a logo file in here named after the sponsor, and it fills in
automatically on the public Rankings page for any sponsor you've already
added in Admin → Sponsors that doesn't have a logo uploaded there.

## Naming

Filename (without the extension) must match the sponsor's name exactly
as entered in Admin → Sponsors — case doesn't matter.

Example: `BCP Plumbing.png` → matches a sponsor named "BCP Plumbing"

## Supported formats

.png, .jpg, .jpeg, .webp, .svg

## Notes

- The sponsor still needs to exist as a record in Admin → Sponsors
  (name, position, active/inactive) — this folder only supplies the
  image, it doesn't create the sponsor itself.
- If a logo is uploaded for the same sponsor through the Admin panel,
  that upload takes priority over a file here with the same name.
- Restart the server (`npm start`) after adding new files here.
