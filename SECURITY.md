# BP Fashion Park security setup

The Firebase web configuration identifies the public web application. It is not an administrator credential. Firestore Security Rules and Firebase App Check protect the data.

## Before production

1. In Firebase Authentication, enable **Email/Password** and create only the owner account. Do not enable public registration.
2. Deploy the checked-in rules with `firebase deploy --only firestore:rules`.
3. In Google Cloud Console, confirm the Firebase browser key is restricted to Firebase APIs and add the production domain as an HTTP referrer restriction.
4. In Firebase App Check, register the web app with reCAPTCHA Enterprise. Put the public site key in `environment.appCheck.recaptchaEnterpriseSiteKey`, deploy, verify valid requests in App Check metrics, and only then enable enforcement for Firestore and Authentication.
5. In Cloudinary, create an unsigned upload preset restricted to:
   - the `bp-fashion-park/products` folder;
   - JPEG, PNG, WebP and AVIF images;
   - a maximum file size of 8 MB;
   - image uploads only;
   - no overwrite of existing assets.
6. Never add a Firebase service-account JSON file, Cloudinary API secret, administrator password, or private API token to this repository or an Angular environment file.
7. Enable Firebase and Google Cloud budget alerts. App Check and budget alerts reduce abuse but do not act as hard spending caps.

## Secure Cloudinary deletion

Existing Cloudinary assets require an authenticated server-side destroy request. The Angular application calls the authenticated Firebase callable function in `functions/src/index.ts`; the Cloudinary API secret must never be placed in an Angular environment file.

Set the three function secrets and deploy the function:

```sh
firebase functions:secrets:set CLOUDINARY_CLOUD_NAME
firebase functions:secrets:set CLOUDINARY_API_KEY
firebase functions:secrets:set CLOUDINARY_API_SECRET
firebase deploy --only functions:deleteCloudinaryImage
```

The function requires Firebase Authentication and App Check, only accepts product-folder public IDs, and invalidates cached Cloudinary copies after deletion.

## Deployment

This project uses Angular SSR, so deploy the web application with **Firebase App Hosting**, not classic static Firebase Hosting. The checked-in `apphosting.yaml` keeps zero idle instances and limits automatic scaling to three instances for this small catalog. This is a cost-control measure, not a hard spending cap.

1. Put the repository on GitHub.
2. In Firebase Console, open **App Hosting**, create a backend, connect the repository and choose the production branch.
3. Set the app root to `/`, where `package.json` and `apphosting.yaml` live.
4. Choose a European region close to the customers and enable automatic rollouts only for the production branch.
5. Deploy Firestore rules separately with `firebase deploy --only firestore:rules`.
6. After the first rollout, add the App Hosting domain to Firebase Authentication authorized domains and to the Firebase browser-key HTTP referrer restrictions.

`firebase.json` intentionally contains only Firestore configuration; App Hosting reads `apphosting.yaml` and detects the Angular SSR adapter from the repository.
