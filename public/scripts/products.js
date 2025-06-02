async function deleteProduct(productId) {
  console.log(productId);
  

  const isConfirmed = confirm("Bạn có chắc chắn muốn xóa sản phẩm này không?");
  if (!isConfirmed) return;

  try {
    const response = await fetch(`/v1/product/delete-product/${productId}`, { method: "DELETE" });

    if (response.ok) {
      alert("Xóa sản phẩm thành công!");
      location.reload();
    } else {
      alert("Xóa sản phẩm thất bại!");
    }
  } catch (error) {
    console.error("Lỗi:", error);
    alert("Đã xảy ra lỗi khi xóa sản phẩm!");
  }
}
