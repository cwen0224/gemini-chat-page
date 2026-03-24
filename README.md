# Gemini Chat Page

A static Gemini chat UI built for GitHub Pages.

## What it does

- Lets you chat with Gemini from the browser
- Stores the API key and chat history in localStorage
- Uses the Gemini REST API directly from the front end

## Files

- `index.html` - the app shell
- `styles.css` - layout and visual design
- `app.js` - chat logic and Gemini API calls

## Run locally

Open `index.html` in a browser, or serve the folder with any static server.

## GitHub Pages deploy

1. Push these files to a GitHub repository.
2. In GitHub, open `Settings` -> `Pages`.
3. Set the source to the branch and folder that contains `index.html`.
4. Wait for GitHub Pages to publish the site.

## Notes

- Do not hardcode a public API key into the repository unless you are OK with it being visible to everyone.
- For safer use, keep the key restricted to the Gemini API and store it in your browser only.
