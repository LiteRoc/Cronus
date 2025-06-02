// Validate the token
const token = localStorage.getItem('token');
if (!token) {
    alert('You are not logged in!');
    window.location.href = '/auth/login';
}
