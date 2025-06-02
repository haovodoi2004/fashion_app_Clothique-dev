const axios = require("axios");

const addressController = {
  getProvinces: async (req, res) => {
    try {
      const response = await axios.get(
        `https://dev-online-gateway.ghn.vn/shiip/public-api/master-data/province`,
        { headers: { Token: process.env.GHN_DEV_TOKEN } }
      );

      const filteredData = response.data.data.map((province) => ({
        ProvinceID: province.ProvinceID,
        ProvinceName: province.ProvinceName,
        Code: province.Code,
      }));

      res.json(filteredData);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Lỗi khi lấy danh sách tỉnh", error: error.message });
    }
  },
  getDistrictsByProvinceId: async (req, res) => {
    try {
      const { provinceId } = req.body; // Lấy từ query params thay vì body
      if (!provinceId)
        return res.status(400).json({ message: "Thiếu provinceId" });

      const response = await axios.get(
        `https://dev-online-gateway.ghn.vn/shiip/public-api/master-data/district`,
        {
          headers: {
            Token: process.env.GHN_DEV_TOKEN,
            "Content-Type": "application/json",
          },
          params: { province_id: Number(provinceId) }, // Đưa vào params thay vì body
        }
      );

      // Lọc dữ liệu trả về để tối ưu hơn
      const filteredData = response.data.data.map((district) => ({
        DistrictID: district.DistrictID,
        ProvinceID: district.ProvinceID,
        DistrictName: district.DistrictName,
        Code: district.Code, // Nếu cần lấy mã quận/huyện
      }));

      res.json(filteredData);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Lỗi khi lấy danh sách quận", error: error.message });
    }
  },
  
  getWardByDistrictId: async (req, res) => {
    try {
      const { districtId } = req.body;
      if (!districtId)
        return res.status(400).json({ message: "Thiếu districtId" });

      const response = await axios.post(
        `https://dev-online-gateway.ghn.vn/shiip/public-api/master-data/ward?district_id`,
        { district_id: Number(districtId) },
        {
          headers: {
            Token: process.env.GHN_DEV_TOKEN,
            "Content-Type": "application/json",
          },
        }
      );
      res.json(response.data.data);
    } catch (error) {
      res.status(500).json({
        message: "Lỗi khi lấy danh sách phường",
        error: error.message,
      });
    }
  },
};

module.exports = addressController;
