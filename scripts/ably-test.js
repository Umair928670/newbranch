(async () => {
  try {
    const base = process.env.BASE || 'http://localhost:3001';
    const email = `test+ably${Date.now()}@example.com`;
    console.log('Signing up with', email);
    const signupRes = await fetch(`${base}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ably Test', email, password: 'password', role: 'passenger' })
    });
    const signup = await signupRes.json();
    if (!signupRes.ok) throw new Error('Signup failed: ' + JSON.stringify(signup));
    console.log('Created user id:', signup.id);

    const ridesRes = await fetch(`${base}/api/rides`);
    const rides = await ridesRes.json();
    if (!ridesRes.ok || !Array.isArray(rides) || rides.length === 0) {
      throw new Error('No rides available to book');
    }
    const rideId = rides[0].id;
    console.log('Using ride id:', rideId);

    const bookingRes = await fetch(`${base}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rideId, passengerId: signup.id, seatsBooked: 1 })
    });
    const booking = await bookingRes.json();
    if (!bookingRes.ok) throw new Error('Booking failed: ' + JSON.stringify(booking));
    console.log('Booking created:', booking.id);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
