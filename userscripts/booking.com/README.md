# Booking.com Userscripts

Two userscripts for Booking.com: a review-aware score on each search result, and links to cross-check a hotel on Google, TripAdvisor, and Super.com.

## Booking Listing Score

Adds a review-aware score pill to each result on Booking.com search pages.

- combines the guest rating and the number of reviews into one score, so a 9.0 from 12 reviews does not outrank a 9.0 from 2,000
- colors each pill relative to the other results on the page (red to yellow to green)
- shows the score on Booking's own 1-10 scale next to the property title: a 95% lower bound on the guest rating given its review count, so a 9.3 from 1,500 reviews stays about 9.2 while an 8.2 from 12 reviews shows 6.1; hover for the rating, review count, and page rank
- also marks map pins with a score pill, matched to the pin by total stay price
- re-scores as you scroll, filter, or load more results

![Booking Listing Score pill on a search result](./demo/booking-score-card.jpg)

Runs on `booking.com/searchresults.html`.

## Booking Hotel Links

Adds a row of search links under the property header on Booking.com hotel pages, so you can cross-check the same property elsewhere.

- links to Google, Google Travel, Google Maps, TripAdvisor, and Super.com
- builds the query from the property name, address, and city
- carries over your check-in and check-out dates and guest count where the target site supports them

![Booking Hotel Links bar under the property header](./demo/booking-hotel-links-bar.jpg)

Runs on `booking.com/hotel/*`.

## Limitations

- scores are relative to the results currently loaded on the page
- map pin scores are matched by price, so pins sharing a price show an averaged score
- price parsing expects dollar amounts
