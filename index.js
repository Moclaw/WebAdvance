// server.js

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3000;
mongoose.set('strictQuery', false);
// Kết nối tới MongoDB
mongoose.connect('mongodb+srv://bookapplication:iojBUlI2FOjVdaaq@bookapplication.ehzaka1.mongodb.net/?retryWrites=true&w=majority', {
	useNewUrlParser: true,
})
	.then(() => console.log('Đã kết nối tới MongoDB'))
	.catch((err) => console.error('Lỗi kết nối MongoDB:', err));

// Định nghĩa cấu trúc bảng sách, người dùng, đơn hàng
// (Sẽ sử dụng các Schema của mongoose)

// Định nghĩa Schema cho sách
const bookSchema = new mongoose.Schema({
	title: { type: String, required: true },
	author: { type: String, required: true },
	price: { type: Number, required: true },
	file: { type: String, required: false },
});

// Định nghĩa Schema cho người dùng
const userSchema = new mongoose.Schema({
	username: { type: String, required: true, unique: true },
	password: { type: String, required: true },
	role: { type: String, enum: ['user', 'admin'], default: 'user' },
});

// Định nghĩa Schema cho đơn hàng
const orderSchema = new mongoose.Schema({
	user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
	books: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true }],
	totalAmount: { type: Number, required: true },
	date: { type: Date, default: Date.now },
	status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
});

// Tạo các mô hình từ Schema
const Book = mongoose.model('Book', bookSchema);
const User = mongoose.model('User', userSchema);
const Order = mongoose.model('Order', orderSchema);

// Sử dụng body-parser middleware để đọc dữ liệu từ các request
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const SECRET_KEY = 'dasdhqwdhajsda';
// Định nghĩa các route và xử lý logic cho ứng dụng
app.get('/', (req, res) => {
	//file index.html
	res.sendFile(__dirname + '/public/index.html');
});
app.post('/register', async (req, res) => {
	try {
		// Kiểm tra xem username đã tồn tại chưa
		const existingUser = await User.findOne({ username: req.body.username });
		if (existingUser) {
			return res.status(409).json({ message: 'Username đã tồn tại. Vui lòng chọn username khác.' });
		}

		// Nếu chưa tồn tại thì tạo mới người dùng
		const hashedPassword = await bcrypt.hash(req.body.password, 10);
		const newUser = new User({
			username: req.body.username,
			password: hashedPassword,
			role: 'user',
		});

		await newUser.save();
		res.status(201).json({ message: 'Đăng ký tài khoản thành công.' });
	}
	catch (err) {
		console.error(err);
		res.status(500).json({ message: 'Đã xảy ra lỗi khi đăng ký tài khoản.' });
	}
});

// Đăng nhập
app.post('/login', async (req, res) => {
	try {
		// Tìm người dùng trong database
		const user = await User.findOne({ username: req.body.username });
		if (!user) {
			return res.status(401).json({ message: 'Tên người dùng không tồn tại.' });
		}

		// Nếu tìm thấy thì kiểm tra mật khẩu
		const isPasswordValid = await bcrypt.compare(req.body.password, user.password);
		if (!isPasswordValid) {
			return res.status(401).json({ message: 'Mật khẩu không đúng.' });
		}

		// Nếu mật khẩu khớp thì tạo mã token và trả về cho người dùng
		const token = jwt.sign(
			{ userId: user._id, username: user.username, role: user.role },
			SECRET_KEY, // Thay 'SECRET_KEY' bằng một chuỗi bí mật thực tế
			{ expiresIn: '10h' }
		);

		res.status(200).json({ token: token, success: true, userId: user._id, role: user.role, username: user.username });
	}
	catch (err) {
		console.error(err);
		res.status(500).json({ message: 'Đã xảy ra lỗi khi đăng nhập.' });
	}
});

// lấy thông tin người dùng hiện tại
app.get('/me', authenticateToken, async (req, res) => {
	try {
		// Tìm người dùng trong database
		const user = await User.findById(req.user.userId);

		if (!user) {
			return res.status(401).json({ message: 'Người dùng không tồn tại.' });
		}
		res.status(200).json({ userId: user._id, username: user.username, role: user.role, success: true });
	}
	catch (err) {
		console.error(err);
		res.status(500).json({ message: 'Đã xảy ra lỗi khi lấy thông tin người dùng.' });
	}
});

// Lấy thông tin danh sách người dùng (chỉ admin mới có quyền)
app.get('/users', async (req, res) => {
	try {
		res.sendFile(__dirname + '/public/userList.html');
	}
	catch (err) {
		console.error(err);
		res.status(500).json({ message: 'Đã xảy ra lỗi khi lấy danh sách người dùng.' });
	}
});

app.get('/usersAll', async (req, res) => {
	try {
		// Lấy danh sách người dùng từ database
		const users = await User.find();

		res.status(200).json(users);
	}
	catch (err) {
		console.error(err);
		res.status(500).json({ message: 'Đã xảy ra lỗi khi lấy danh sách người dùng.' });
	}
});

//update user
app.put('/users/:id', authenticateToken, async (req, res) => {
	try {
		//sửa thông tin người dùng
		const user = await User.findById(req.params.id);
		if (!user) {
			return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
		}

		const { username, password } = req.body;
		if (username) {
			user.username = username;
		}
		if (password) {
			user.password = await bcrypt.hash(password, 10);
		}
		await user.save();
		res.status(200).json({ message: 'Cập nhật thông tin người dùng thành công.', success: true });
	}
	catch (err) {
		console.error(err);
		res.status(500).json({ message: 'Đã xảy ra lỗi khi cập nhật thông tin người dùng.' });
	}
});


// Cấu hình middleware để kiểm tra token cho các route yêu cầu xác thực
function authenticateToken(req, res, next) {
	const authHeader = req.headers['authorization'];
	const token = authHeader && authHeader.split(' ')[1];

	if (!token) {
		return res.status(401).json({ message: 'Token không tồn tại. Vui lòng đăng nhập.' });
	}

	jwt.verify(token, SECRET_KEY, (err, user) => {
		if (err) {
			return res.status(403).json({ message: 'Token không hợp lệ.' });
		}
		req.user = user;
		next();
	});
}

// Lấy danh sách sách
app.get('/booksList', async (req, res) => {
	try {
		res.sendFile(__dirname + '/public/bookList.html');
	}
	catch (err) {
		console.error(err);
		res.status(500).json({ message: 'Đã xảy ra lỗi khi lấy danh sách sách.' });
	}
});

// API lấy danh sách sách
app.get('/books', async (req, res) => {
	try {
		// Lấy trang hiện tại từ tham số "page", mặc định là 1 nếu không có
		const currentPage = parseInt(req.query.page) || 1;

		// Số sách trên mỗi trang
		const booksPerPage = 10;

		// Tính vị trí bắt đầu và vị trí kết thúc trong database dựa trên trang hiện tại và số sách trên mỗi trang
		const startIndex = (currentPage - 1) * booksPerPage;
		const endIndex = startIndex + booksPerPage;

		// Lấy tổng số sách trong database
		const totalBooks = await Book.countDocuments();

		// Lấy danh sách sách từ database với phân trang
		const books = await Book.find().skip(startIndex).limit(booksPerPage);

		// Tính tổng số trang dựa trên tổng số sách và số sách trên mỗi trang
		const totalPages = Math.ceil(totalBooks / booksPerPage);

		// Gửi kết quả về cho client
		res.status(200).json({
			books: books,
			totalPages: totalPages
		});
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: 'Đã xảy ra lỗi khi lấy danh sách sách.' });
	}
});



// Thêm sách mới
app.post('/books', authenticateToken, async (req, res) => {
	try {
		// Kiểm tra xem người dùng có quyền thêm sách hay không
		if (req.user.role !== 'admin') {
			return res.status(403).json({ message: 'Bạn không có quyền thêm sách.' });
		}

		// Nếu có quyền thì tạo sách mới
		const newBook = new Book({
			title: req.body.title,
			author: req.body.author,
			price: req.body.price,
			file: req.file // Lưu tên file hình ảnh vào trường 'file'
		});

		await newBook.save();
		res.status(201).json(newBook);
	}
	catch (err) {
		console.error(err.message);
		res.status(500).json({ message: err.message });
	}
});

// Lấy thông tin sách
app.get('/books/:id', async (req, res) => {
	try {
		const book = await Book.findById(req.params.id);

		if (!book) {
			return res.status(404).json({ message: 'Không tìm thấy sách.' });
		}

		res.status(200).json(book);
	}
	catch (err) {
		console.error(err);
		res.status(500).json({ message: 'Đã xảy ra lỗi khi lấy thông tin sách.' });
	}
});

// Tìm kiếm sách theo tiêu đề hoặc tác giả
app.get('/books/search', async (req, res) => {
	try {
		const keyword = req.query.keyword;
		// Sử dụng regex để tìm kiếm các sách có tiêu đề hoặc tác giả chứa keyword
		const books = await Book.find({
			$or: [
				{ title: { $regex: keyword, $options: 'i' } }, // Tìm kiếm tiêu đề chứa keyword (không phân biệt hoa thường)
				{ author: { $regex: keyword, $options: 'i' } } // Tìm kiếm tác giả chứa keyword (không phân biệt hoa thường)
			]
		});

		res.status(200).json({ books: books });
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: 'Đã xảy ra lỗi khi tìm kiếm sách.' });
	}
});


// Cập nhật thông tin sách
app.put('/books/:id', authenticateToken, async (req, res) => {
	try {
		// Kiểm tra xem người dùng có quyền cập nhật sách hay không
		if (req.user.role !== 'admin') {
			return res.status(403).json({ message: 'Bạn không có quyền cập nhật sách.' });
		}

		// Nếu có quyền thì cập nhật thông tin sách
		const updatedBook = {
			title: req.body.title,
			author: req.body.author,
			price: req.body.price,
			file: req.body.file
		};

		const result = await Book.findByIdAndUpdate(req.params.id, updatedBook, { new: true });

		res.status(200).json(result);
	}
	catch (err) {
		console.error(err);
		res.status(500).json({ message: 'Đã xảy ra lỗi khi cập nhật thông tin sách.' });
	}
});


// ...

// Xóa sách
app.delete('/books/:id', authenticateToken, async (req, res) => {
	try {
		// Kiểm tra xem người dùng có quyền xóa sách hay không
		if (req.user.role !== 'admin') {
			return res.status(403).json({ message: 'Bạn không có quyền xóa sách.' });
		}

		// Nếu có quyền thì xóa sách
		await Book.findByIdAndRemove(req.params.id);

		res.status(200).json({ message: 'Sách đã được xóa.' });
	}
	catch (err) {
		console.error(err);
		res.status(500).json({ message: 'Đã xảy ra lỗi khi xóa sách.' });
	}
});

// ...

app.get('/carts', async (req, res) => {
	try {
		res.sendFile(__dirname + '/public/cart.html');
	}
	catch (err) {
		console.error(err);
		res.status(500).json({ message: 'Đã xảy ra lỗi khi lấy giỏ hàng.' });
	}
});

/// Lấy danh sách đơn hàng
app.get('/orders', authenticateToken, async (req, res) => {
	try {
		// Kiểm tra xem người dùng có quyền xem danh sách đơn hàng hay không
		if (req.user.role !== 'admin') {
			return res.status(403).json({ message: 'Bạn không có quyền xem danh sách đơn hàng.' });
		}


		const orders = await Order.find().populate('user').populate('books');

		res.status(200).json(orders);
	}
	catch (err) {
		console.error(err);
		res.status(500).json({ message: 'Đã xảy ra lỗi khi lấy danh sách đơn hàng.' });
	}
});

app.get('/ordersbyuserid/:userId', async (req, res) => {
	try {
		const userId = req.params.userId;
		const orders = await Order.find({ user: userId }).populate('user').populate('books');

		res.status(200).json(orders);
	}
	catch (err) {
		console.error(err);
		res.status(500).json({ message: 'Đã xảy ra lỗi khi lấy danh sách đơn hàng.' });
	}
});

// Lấy thông tin đơn hàng theo ID
app.get('/orders/:id', authenticateToken, async (req, res) => {
	try {
		// Kiểm tra xem người dùng có quyền xem thông tin đơn hàng hay không
		if (req.user.role !== 'admin') {
			return res.status(403).json({ message: 'Bạn không có quyền xem thông tin đơn hàng.' });
		}

		// Nếu có quyền thì lấy thông tin đơn hàng theo ID
		const order = await Order.findById(req.params.id).populate('user').populate('books');

		if (!order) {
			return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
		}

		res.status(200).json(order);
	}
	catch (err) {
		console.error(err);
		res.status(500).json({ message: 'Đã xảy ra lỗi khi lấy thông tin đơn hàng.' });
	}
});


// Thêm đơn hàng mới (Thêm vào giỏ hàng)
app.post('/orders', authenticateToken, async (req, res) => {
	try {
		// Lấy thông tin sách và tổng giá từ body request
		const { books, totalAmount, userId } = req.body;

		// Tạo đơn hàng mới
		const newOrder = await Order.create({
			user: userId,
			books,
			totalAmount,
		});

		// Trả về kết quả đơn hàng vừa được tạo
		res.status(201).json({ message: 'Đơn hàng đã được tạo thành công.', order: newOrder, success: true });
	}
	catch (err) {
		console.error(err);
		res.status(500).json({ message: 'Đã xảy ra lỗi khi thêm đơn hàng.' });
	}
});

app.put('/orders/approve/:id', authenticateToken, async (req, res) => {
	try {
		// Kiểm tra xem người dùng có quyền xác nhận đơn hàng hay không
		if (req.user.role !== 'admin') {
			return res.status(403).json({ message: 'Bạn không có quyền xác nhận đơn hàng.' });
		}

		// Lấy ID của đơn hàng cần xác nhận từ request params
		const orderId = req.params.id;

		// Tìm đơn hàng và cập nhật trạng thái đã xác nhận
		const updatedOrder = await Order.findByIdAndUpdate(orderId, { status: 'approved' }, { new: true });

		if (!updatedOrder) {
			return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
		}

		// Trả về thông báo xác nhận đơn hàng thành công
		res.status(200).json({ message: 'Đơn hàng đã được xác nhận thành công.' });
	}
	catch (err) {
		console.error(err);
		res.status(500).json({ message: 'Đã xảy ra lỗi khi xác nhận đơn hàng.' });
	}
});

app.put('/orders/reject/:id', authenticateToken, async (req, res) => {
	try {
		// Kiểm tra xem người dùng có quyền xác nhận đơn hàng hay không
		if (req.user.role !== 'admin') {
			return res.status(403).json({ message: 'Bạn không có quyền xác nhận đơn hàng.' });
		}

		// Lấy ID của đơn hàng cần xác nhận từ request params
		const orderId = req.params.id;

		// Tìm đơn hàng và cập nhật trạng thái đã xác nhận
		const updatedOrder = await Order.findByIdAndUpdate(orderId, { status: 'rejected' }, { new: true });

		if (!updatedOrder) {
			return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
		}

		// Trả về thông báo xác nhận đơn hàng thành công
		res.status(200).json({ message: 'Đơn hàng đã được xác nhận thành công.' });
	}
	catch (err) {
		console.error(err);
		res.status(500).json({ message: 'Đã xảy ra lỗi khi xác nhận đơn hàng.' });
	}
});


// Xóa đơn hàng (Xóa giỏ hàng)
app.delete('/orders/:id', authenticateToken, async (req, res) => {
	try {
		const order = await Order.findById(req.params.id);
		console.log(order);
		// Kiểm tra xem người dùng có quyền xóa đơn hàng hay không nếu không phải admin và khổng phải userId đó tạo thì không có quyền xóa
		if (req.user.role !== 'admin' && req.body.userId !== order.user.userId) {
			return res.status(403).json({ message: 'Bạn không có quyền xóa đơn hàng.' });
		}


		// Lấy ID của đơn hàng cần xóa từ request params
		const orderId = req.params.id;

		// Tìm đơn hàng và xóa khỏi cơ sở dữ liệu
		const deletedOrder = await Order.findByIdAndDelete(orderId);

		if (!deletedOrder) {
			return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
		}

		// Trả về thông báo xác nhận đơn hàng đã được xóa thành công
		res.status(200).json({ message: 'Đơn hàng đã được xóa thành công.', success: true });
	}
	catch (err) {
		console.error(err);
		res.status(500).json({ message: 'Đã xảy ra lỗi khi xóa đơn hàng.' });
	}
});


// Start server
app.listen(port, () => {
	console.log(`Server đang lắng nghe tại http://localhost:${port}`);
});
