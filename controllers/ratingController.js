const mongoose = require("mongoose");
const Rating = require("../models/Rating");

const ratingController = {

    // Thêm đánh giá
    addRating: async (req, res) => {
        try {
            const { productId, userId, variants, rating } = req.body;

            if (!mongoose.Types.ObjectId.isValid(productId)) {
                return res.status(400).json({ message: "ID sản phẩm không hợp lệ!" });
            }

            if (rating < 1 || rating > 5) {
                return res.status(400).json({ message: "Điểm đánh giá phải từ 1 đến 5!" });
            }

            // Kiểm tra xem người dùng đã đánh giá chưa
            let existingRating = await Rating.findOne({ productId, userId });

            if (existingRating) {
                // Nếu đã có đánh giá, cập nhật rating mới
                existingRating.rating = rating;
                await existingRating.save();
                return res.status(200).json({ message: "Đánh giá đã được cập nhật!", rating: existingRating });
            } else {
                // Nếu chưa có đánh giá, tạo mới
                const newRating = new Rating({ productId, userId, variants, rating });
                await newRating.save();
                return res.status(201).json({ message: "Đánh giá đã được thêm!", rating: newRating });
            }
        } catch (error) {
            res.status(500).json({ message: "Lỗi server!", error: error.message });
        }
    },

    // Lấy danh sách đánh giá của một sản phẩm
    getRatingsByProduct: async (req, res) => {
        try {
            const { productId } = req.params;

            if (!mongoose.Types.ObjectId.isValid(productId)) {
                return res.status(400).json({ message: "ID sản phẩm không hợp lệ!" });
            }

            const ratings = await Rating.find({ productId }).populate("userId", "name").populate("productId", "name").populate("variants", "images");; // Lấy thông tin người đánh giá
            res.json(ratings);
        } catch (error) {
            res.status(500).json({ message: "Lỗi server!", error: error.message });
        }
    },

    // lấy danh sách đánh giá qua userID 
    getRatingsByUser: async (req, res) => {
        try {
            const { userId } = req.params;

            if (!mongoose.Types.ObjectId.isValid(userId)) {
                return res.status(400).json({ message: "ID người dùng không hợp lệ!" });
            }

            const ratings = await Rating.find({ userId })
                .populate("userId", "name avatar")
                .populate("productId", "name")
                .populate("variants", "images");
            res.status(200).json(ratings);
        } catch (error) {
            res.status(500).json({ message: "Lỗi server!", error: error.message });
        }
    },

    // Thống kê số lượng đánh giá theo từng mức sao
    getRatingSummary: async (req, res) => {
        try {
            const { productId } = req.params;

            // Kiểm tra productId có hợp lệ không
            if (!mongoose.Types.ObjectId.isValid(productId)) {
                return res.status(400).json({ message: "ID sản phẩm không hợp lệ!" });
            }

            // Truy vấn tính tổng số đánh giá và điểm trung bình
            const summary = await Rating.aggregate([
                { $match: { productId: new mongoose.Types.ObjectId(productId) } },
                {
                    $group: {
                        _id: null,
                        totalRatings: { $sum: 1 }, // Tổng số đánh giá
                        averageRating: { $avg: "$rating" } // Điểm trung bình
                    }
                }
            ]);

            // Nếu không có đánh giá nào
            if (summary.length === 0) {
                return res.status(200).json({ totalRatings: 0, averageRating: 0 });
            }

            // Trả kết quả về
            res.status(200).json({
                totalRatings: summary[0].totalRatings,
                averageRating: summary[0].averageRating.toFixed(1) // Làm tròn 1 chữ số thập phân
            });
        } catch (error) {
            res.status(500).json({ message: "Lỗi server!", error: error.message });
        }
    },

    // Xóa đánh giá (chỉ admin mới được xóa)
    deleteRating: async (req, res) => {
        try {
            const { ratingId } = req.params;
            const deletedRating = await Rating.findByIdAndDelete(ratingId);

            if (!deletedRating) {
                return res.status(404).json({ message: "Không tìm thấy đánh giá!" });
            }

            res.status(200).json({ message: "Đánh giá đã được xóa!" });
        } catch (error) {
            res.status(500).json({ message: "Lỗi server!", error: error.message });
        }
    }
};

module.exports = ratingController;