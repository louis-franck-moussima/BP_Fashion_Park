# Firestore backup and recovery

BP Fashion Park uses Firestore managed exports for recoverable catalog backups. Managed export/import requires billing (Firebase Blaze), a Cloud Storage bucket near the Firestore database, and the appropriate Firestore import/export and Storage permissions.

Official documentation:

- https://firebase.google.com/docs/firestore/manage-data/export-import
- https://firebase.google.com/docs/firestore/backups

## One-time setup

1. Open Google Cloud Console for project `bp-fashion-park`.
2. Create a dedicated Cloud Storage bucket in or near the Firestore database location, for example `gs://bp-fashion-park-firestore-backups`.
3. Do not enable Requester Pays or use a Rapid bucket.
4. Confirm the Cloud Firestore service agent has Storage Admin access to this bucket.
5. In Cloud Shell, select the project:

   ```sh
   gcloud config set project bp-fashion-park
   ```

## Manual full export

Use a dated folder so exports are never overwritten:

```sh
gcloud firestore export gs://bp-fashion-park-firestore-backups/manual/2026-11-08 --database='(default)'
```

Monitor operations:

```sh
gcloud firestore operations list
```

Exports incur one Firestore read per exported document and Cloud Storage charges. These reads do not appear in the Firebase console usage section.

## Restore

Before restoring, confirm the project, database and export path. An import writes exported documents but does not automatically remove unrelated documents already present.

```sh
gcloud firestore import gs://bp-fashion-park-firestore-backups/manual/2026-11-08 --database='(default)'
```

Never test a restore against production first. Restore into a separate test database/project, verify categories, products, stock history, customer requests and store settings, and only then schedule a production recovery window.

## Recommended schedule

- Enable Firestore scheduled backups in Google Cloud Console for routine recovery.
- Keep a weekly managed export for four weeks and a monthly export for twelve months.
- Configure a Cloud Storage lifecycle rule to remove exports after the agreed retention period.
- Perform and document a test restore at least twice per year.

Scheduled exports can also be automated with Cloud Scheduler and Cloud Functions, but every schedule should have a budget alert because exports incur reads and storage charges.
