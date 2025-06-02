const Favourite = require('../models/Favourite');

const favourtieController = {
    // Thêm/xóa sản phẩm khỏi danh sách yêu thích
    toggleFavourite: async (req, res) => {
        try {
            const { productId } = req.body;
            const userId = req.user.id;
            const existingFavourite = await Favourite.findOne({ userId, productId });
            if (existingFavourite) {
                await existingFavourite.deleteOne();
                return res.status(200).json({ message: "Đã xóa khỏi danh sách yêu thích" })
            }
            const newFavourite = new Favourite({ userId, productId }); 
            await newFavourite.save();
            res.status(200).json({ message: "Đã thêm vào danh sách yêu thích" })
        } catch (error) {
            res.status(200).json({ message: error.message });
        }
    },

    // Lấy danh sách sản phẩm yêu thích của người dùng
    getUserFavourites: async (req, res) => {
        try {
            const userId = req.user.id;
            const favourites = await Favourite.find({ userId })
                .populate({
                    path: "productId",
                    populate: { path: "variants" },
                });
            res.status(200).json({ favourites });
        } catch (error) {
            res.status(200).json({ message: error.message });
        }
    },

    // Kiểm tra sản phẩm có trong danh sách yêu thích không
    checkFavourite: async (req, res) => {
        try {
            const { id: productId } = req.message;
            const userId = req.user.id;
            const isFavourite = await Favourite.exists({ userId, productId });
            res.status(200).json({ favourite: isFavourite ? true : false });
        } catch (error) {
            res.status(200).json({ message: error.message });
        }
    },

    // Xóa sản phẩm khỏi danh sách yêu thích
    removeFavourite: async (req, res) => {
        try {
            const userId = req.user.id;
            const productId = req.params.productId;

            const result = await Favourite.findOneAndDelete({ userId, productId });

            if (!result) {
                return res.status(404).json({ message: "Sản phẩm không tồn tại trong danh sách yêu thích!" });
            }

            res.status(200).json({ message: "Đã xóa sản phẩm khỏi danh sách yêu thích!" });
        } catch (err) {
            res.status(500).json({ message: "Lỗi server!" });
        }
    },

};

module.exports = favourtieController;