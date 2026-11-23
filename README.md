# Inkwell

A smart bookstore website built for a software engineering course. Browse public-domain classics, buy them with a demo balance, leave reviews, and get recommendations from a mood or a chat question.

## Run it

```
python3 -m http.server 8000
```

Then open http://localhost:8000. There is nothing to install.

## What it does

- Four kinds of users: visitor, registered customer, VIP customer, and super-user. Each sees different pages.
- Search the catalog by keyword, category, author, year, or a picture.
- Buy books from an account balance. VIPs get 10% off. Overspending costs a $1 fine, and a negative balance suspends the account.
- Rate and review books. Banned words are masked, and too many get the comment blocked and the author warned.
- Sign in with your face through the camera. No passwords.
- Chat and mood matcher. They answer from local store info first. If you run [Ollama](https://ollama.com) (`ollama pull llama3.2`), they also use a local AI model.
- Admin tools: add books, manage banned words, reopen suspended accounts, view a finance report.

## Try it

Pick a demo account on the Sign in page.

| Account | Try |
|---|---|
| Alex Rivera | Buy four books to become VIP |
| Priya Shah | VIP prices and chat answers |
| Sam Lee | Buy a book to see the fine and suspension |
| Morgan Ellis | Admin tools |

## Notes

- Data is saved in your browser only, and all money is fictional. The Reset link in the footer restores the sample data.
- Picture search matches cover colours, and face matching is a simple demo version. Neither is secure or production-grade.
- Run the tests with `node --test tests/*.test.js`.

Books are from [Project Gutenberg](https://www.gutenberg.org).
