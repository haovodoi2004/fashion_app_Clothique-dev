const User = require("../models/User");
const axios = require("axios");
const mongoose = require("mongoose");
const ObjectId = require('mongoose').Types.ObjectId;

const userController = {

  getUserInfo: async (req, res) => {
    try {
      const user = await User.findOne({ email: req.user.email }).select("-password");
      if (!user) {
        return res.status(404).json({ message: "Người dùng không tồn tại" });
      }
      if (req.user.email === user.email) {
        user.lastActive = new Date();
        await user.save();
      }
      res.status(200).json(user);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Get all users
  getAllUsers: async (req, res) => {
    try {
      const users = await User.find({ admin: { $ne: true } }).select(
        "-password"
      );
      res.status(200).json({ users });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
  // Delete user
  deleteUser: async (req, res) => {
    try {
      const user = await User.findByIdAndDelete(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "Không tìm thấy người dùng!" });
      }
      res.status(200).json({ message: "Xóa người dùng thành công!" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
  // Add address
  addAddress: async (req, res) => {
    try {
      // const { email, phoneNumber, name, addressDetail, provinceId, districtId, wardCode, isDefault } = req.body;
      const { email, phoneNumber, name, addressDetail, provinceId, districtId, wardCode } = req.body;

      if (!phoneNumber || !name || !addressDetail || !provinceId || !districtId || !wardCode) {
        return res.status(400).json({ message: "Cần nhập đủ thông tin địa chỉ." });
      }

      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({ message: "User không tồn tại." });
      }
      const provinceRes = await axios.get("https://dev-online-gateway.ghn.vn/shiip/public-api/master-data/province", {
        headers: { Token: process.env.GHN_DEV_TOKEN }
      });
      const province = provinceRes.data.data.find(p => p.ProvinceID === Number(provinceId));

      const districtRes = await axios.get("https://dev-online-gateway.ghn.vn/shiip/public-api/master-data/district", {
        headers: { Token: process.env.GHN_DEV_TOKEN },
        params: { province_id: Number(provinceId) }
      });
      const district = districtRes.data.data.find(d => d.DistrictID === Number(districtId));

      const wardRes = await axios.get("https://dev-online-gateway.ghn.vn/shiip/public-api/master-data/ward", {
        headers: { Token: process.env.GHN_DEV_TOKEN },
        params: { district_id: Number(districtId) }
      });
      const ward = wardRes.data.data.find(w => w.WardCode === wardCode);

      // 🔹 Thêm địa chỉ vào danh sách của user
      user.addresses.push({
        name,
        phoneNumber,
        addressDetail,
        provinceId,
        provinceName: province?.ProvinceName || "",
        districtId,
        districtName: district?.DistrictName || "",
        wardCode,
        wardName: ward?.WardName || ""
        // isDefault: newIsDefault
      });

      await user.save();
      res.json({ message: "Đã thêm địa chỉ mới.", addresses: user.addresses });
    } catch (error) {
      res.status(500).json({ message: "Lỗi server.", error: error.message });
    }
  },

  // Get addresses
  getAddresses: async (req, res) => {
    try {
      const email = req.query.email || req.body.email;
      const user = await User.findOne({ email });

      if (!user) {
        return res.status(404).json({ message: "User không tồn tại." });
      }

      const addressesWithDetails = await Promise.all(
        user.addresses.map(async (addr) => {
          try {
            // Lấy thông tin tỉnh
            const provinceRes = await axios.get(
              `https://dev-online-gateway.ghn.vn/shiip/public-api/master-data/province`,
              { headers: { Token: process.env.GHN_DEV_TOKEN } }
            );
            const province = provinceRes.data.data.find(
              (p) => p.ProvinceID === addr.provinceId
            );

            // Lấy thông tin quận/huyện
            const districtRes = await axios.get(
              `https://dev-online-gateway.ghn.vn/shiip/public-api/master-data/district`,
              {
                headers: {
                  Token: process.env.GHN_DEV_TOKEN,
                  "Content-Type": "application/json",
                },
                params: { province_id: addr.provinceId },
              }
            );

            const district = districtRes.data.data.find(
              (d) => d.DistrictID === addr.districtId
            );

            // Lấy thông tin phường/xã
            const wardRes = await axios.post(
              `https://dev-online-gateway.ghn.vn/shiip/public-api/master-data/ward?district_id`,
              { district_id: addr.districtId },
              {
                headers: {
                  Token: process.env.GHN_DEV_TOKEN,
                  "Content-Type": "application/json",
                },
              }
            );
            const ward = wardRes.data.data.find(
              (w) => w.WardCode === addr.wardCode
            );

            return {
              name: addr.name,
              phoneNumber: addr.phoneNumber,
              addressDetail: addr.addressDetail,
              province: province
                ? {
                  id: province.ProvinceID,
                  code: province.Code,
                  name: province.ProvinceName,
                }
                : null,
              district: district
                ? {
                  id: district.DistrictID,
                  code: district.Code,
                  name: district.DistrictName,
                }
                : null,
              ward: ward
                ? {
                  id: ward.WardCode,
                  code: ward.WardCode,
                  name: ward.WardName,
                }
                : null,
            };
          } catch (error) {
            console.error("Lỗi khi lấy dữ liệu địa chỉ:", error.message);
            return null;
          }
        })
      );

      // res.json({
      //   addresses: addressesWithDetails.filter((addr) => addr !== null),
      // });

      res.json({
        addresses: user.addresses.map(addr => ({
          ...addr.toObject(),
          _id: addr._id.toString(),
        })),
      });

    } catch (error) {
      res.status(500).json({ message: "Lỗi server.", error: error.message });
    }
  },
  // Remove address
  removeAddress: async (req, res) => {
    try {
      const { email, addressId } = req.body;

      if (!email || !addressId) {
        return res.status(400).json({ message: "Thiếu thông tin đầu vào." });
      }

      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({ message: "User không tồn tại." });
      }

      const initialLength = user.addresses.length;
      user.addresses = user.addresses.filter(
        (address) => address._id.toString() !== addressId
      );

      if (user.addresses.length === initialLength) {
        return res
          .status(404)
          .json({ message: "Không tìm thấy địa chỉ để xóa." });
      }

      await user.save();

      res.json({
        message: "Xóa địa chỉ thành công.",
        addresses: user.addresses,
      });
    } catch (error) {
      console.error("Lỗi khi xóa địa chỉ:", error);
      res.status(500).json({ message: "Lỗi server.", error: error.message });
    }
  },

  updateAdress: async (req, res) => {
    try {
      const {
        email,
        addressId,
        name,
        phoneNumber,
        provinceId,
        districtId,
        wardCode,
        addressDetail,
      } = req.body;

      if (!email || !addressId || !name || !phoneNumber || !provinceId || !districtId || !wardCode || !addressDetail) {
        return res.status(400).json({ message: "Thiếu thông tin địa chỉ." });
      }

      const user = await User.findOne({ email }).select("addresses");
      if (!user) {
        return res.status(404).json({ message: "User không tồn tại." });
      }

      const addressIndex = user.addresses.findIndex(
        (addr) => addr._id.equals(new mongoose.Types.ObjectId(addressId))
      );

      if (addressIndex === -1) {
        return res.status(404).json({ message: "Không tìm thấy địa chỉ." });
      }

      // 🔹 Gọi API GHN để lấy tên địa phương
      const provinceRes = await axios.get("https://dev-online-gateway.ghn.vn/shiip/public-api/master-data/province", {
        headers: { Token: process.env.GHN_DEV_TOKEN }
      });
      const province = provinceRes.data.data.find(p => p.ProvinceID === Number(provinceId));

      const districtRes = await axios.get("https://dev-online-gateway.ghn.vn/shiip/public-api/master-data/district", {
        headers: { Token: process.env.GHN_DEV_TOKEN },
        params: { province_id: Number(provinceId) }
      });
      const district = districtRes.data.data.find(d => d.DistrictID === Number(districtId));

      const wardRes = await axios.get("https://dev-online-gateway.ghn.vn/shiip/public-api/master-data/ward", {
        headers: { Token: process.env.GHN_DEV_TOKEN },
        params: { district_id: Number(districtId) }
      });
      const ward = wardRes.data.data.find(w => w.WardCode === wardCode);

      // 🔹 Cập nhật thông tin địa chỉ
      user.addresses[addressIndex] = {
        ...user.addresses[addressIndex].toObject(),
        name,
        phoneNumber,
        provinceId,
        provinceName: province?.ProvinceName || "",
        districtId,
        districtName: district?.DistrictName || "",
        wardCode,
        wardName: ward?.WardName || "",
        addressDetail,
      };

      await user.save();

      res.json({
        message: "Cập nhật địa chỉ thành công.",
        addresses: user.addresses.map(addr => ({
          ...addr.toObject(),
          _id: addr._id.toString(),
        })),
      });

    } catch (error) {
      console.error("❌ Lỗi khi cập nhật địa chỉ:", error);
      res.status(500).json({ message: "Lỗi server.", error: error.message });
    }
  },

};

module.exports = userController;
