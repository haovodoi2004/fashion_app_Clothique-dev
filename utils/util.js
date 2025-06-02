const axios = require("axios");

async function getGHNServiceId(fromDistrict, toDistrict) {
  try {
    const SHOP_ID = Number(process.env.SHOP_ID);
    const response = await axios.post(
      "https://dev-online-gateway.ghn.vn/shiip/public-api/v2/shipping-order/available-services",
      {
        shop_id: SHOP_ID,
        from_district: Number(fromDistrict) || 3440,
        to_district: Number(toDistrict),
      },
      {
        headers: {
          "Content-Type": "application/json",
          token: process.env.GHN_DEV_TOKEN, // Token cho GHN
        },
      }
    );

    const services = response.data?.data || [];

    if (services.length === 0) {
      throw new Error("Không tìm thấy dịch vụ phù hợp");
    }

    return services[0].service_id; // Aruji-sama có thể chọn theo service_type_id nếu muốn
  } catch (error) {
    console.error(
      "Lỗi lấy service_id từ GHN:",
      error?.response?.data || error.message
    );
    throw error;
  }
}

async function getExpectedDeliveryTime({
  fromDistrict,
  fromWard,
  toDistrict,
  toWard,
  serviceId,
}) {
  const SHOP_ID = Number(process.env.SHOP_ID);
  const response = await axios.post(
    "https://dev-online-gateway.ghn.vn/shiip/public-api/v2/shipping-order/leadtime",
    {
      from_district_id: fromDistrict || 3440,
      from_ward_code: fromWard || "13010",
      to_district_id: toDistrict,
      to_ward_code: toWard,
      service_id: serviceId,
    },
    {
      headers: {
        "Content-Type": "application/json",
        token: process.env.GHN_DEV_TOKEN, // Token cho GHN
        ShopId: SHOP_ID, // SHOP_ID cần được truyền chính xác
      },
    }
  );

  const expectedDeliveryTimestamp = response.data.data.leadtime;
  return expectedDeliveryTimestamp; // convert to JS Date
}

module.exports = {
  getGHNServiceId,
  getExpectedDeliveryTime,
};
