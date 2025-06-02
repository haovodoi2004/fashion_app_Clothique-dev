const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController')
const middlewareController = require('../controllers/middlewareController')

router.get('/', middlewareController.verifyTokenAndAdmin, transactionController.getAllTransactions); // Lấy tất cả giao dịch

router.get('/:id', middlewareController.verifyTokenAndAdmin, transactionController.getTransactionById); // Lấy giao dịch theo ID

module.exports = router;