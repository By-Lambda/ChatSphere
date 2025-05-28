import unittest
from server import app

class TestChatSphere(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

    def test_index_redirect(self):
        response = self.app.get('/')
        self.assertEqual(response.status_code, 302)  # Should redirect to login

    def test_login_page(self):
        response = self.app.get('/login')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'Sign In', response.data)

if __name__ == '__main__':
    unittest.main()