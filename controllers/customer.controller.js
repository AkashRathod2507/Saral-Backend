import { ApiError } from "../utils/ApiError.js";
import { Customer } from "../models/customer.model.js";

const createCustomer = async (req, res) => {
    try {
        const { name, email, phone, address } = req.body;
        const organization_id = req.organization_id || null;

        if (!name || !email) {
            return res.status(400).json({
                success: false,
                message: "Name and email are required"
            });
        }

        // scope by organization if available
        const existingQuery = organization_id ? { email, organization_id } : { email };
        const existingCustomer = await Customer.findOne(existingQuery);

        if (existingCustomer) {
            return res.status(409).json({
                success: false,
                message: "Customer with this email already exists"
            });
        }

        const customerData = {
            name,
            email,
            phone,
            address
        };
        if (organization_id) customerData.organization_id = organization_id;

        const customer = await Customer.create(customerData);

        return res.status(201).json({
            success: true,
            message: "Customer created successfully",
            customer
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error in creating customer",
            error: error.message
        });
    }
};

const getAllCustomers = async (req, res) => {
    try {
        const organization_id = req.organization_id || null;
        const query = organization_id ? { organization_id } : {};
        const customers = await Customer.find(query);
        
        return res.status(200).json({
            success: true,
            customers
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error in fetching customers",
            error: error.message
        });
    }
};

const getCustomerById = async (req, res) => {
    try {
        const organization_id = req.organization_id || null;
        const query = organization_id ? { _id: req.params.id, organization_id } : { _id: req.params.id };
        const customer = await Customer.findOne(query);
        
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer not found"
            });
        }

        return res.status(200).json({
            success: true,
            customer
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error in fetching customer",
            error: error.message
        });
    }
};

const updateCustomer = async (req, res) => {
    try {
        const organization_id = req.organization_id || null;
        const query = organization_id ? { _id: req.params.id, organization_id } : { _id: req.params.id };
        const customer = await Customer.findOneAndUpdate(
            query,
            req.body,
            { new: true, runValidators: true }
        );

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Customer updated successfully",
            customer
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error in updating customer",
            error: error.message
        });
    }
};

const deleteCustomer = async (req, res) => {
    try {
        const organization_id = req.organization_id || null;
        const query = organization_id ? { _id: req.params.id, organization_id } : { _id: req.params.id };
        const customer = await Customer.findOneAndDelete(query);

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Customer deleted successfully"
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error in deleting customer",
            error: error.message
        });
    }
};

export {
    createCustomer,
    getAllCustomers,
    getCustomerById,
    updateCustomer,
    deleteCustomer
};