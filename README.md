# VPSS Pay Sandbox

A static, browser-based payment-flow prototype for learning and UI testing.

## Run it
- Open `index.html` using a local static server, or deploy the folder to Netlify/Vercel.
- Create a test payment link from the dashboard.
- Open the link and try UPI QR, Card, or Netbanking.
- Dashboard refreshes automatically.

## Included
- Dashboard with transaction counts, simulated successful amount, and transaction table.
- Separate controls to clear transaction history or reset all test orders and transactions.
- Create shareable sandbox checkout links.
- UPI QR points to a VPSS Pay test approval page. Optional Supabase Realtime sync updates the desktop dashboard when approved from a phone.
- Fictional netbanking selection and redirect page recording customer name, email, and mobile number.
- Card test form accepts various test card formats and records only cardholder name, detected card network, and last 4 digits.
- Developer buttons for success, failed, pending, and cancelled events.
- CSV export.

## Important limitations
**This is not a payment gateway and never transfers money.** Every status is a fictional sandbox event. Do not enter real card data, CVV, bank passwords, OTPs, or UPI PINs.