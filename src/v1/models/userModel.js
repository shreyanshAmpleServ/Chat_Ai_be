const { PrismaClient } = require("@prisma/client");
const CustomError = require("../../utils/CustomError");
const prisma = new PrismaClient();

// Helper function to define fields returned for a user
const getUserFields = (is_password = false) => ({
  id: true,
  username: true,
  email: true,
  password: is_password,
  full_name: true,
  phone: true,
  address: true,
  employee_id: true,
  profile_img: true,
  is_active: true,
  createdate: true,
  updatedate: true,
});

const getRolePermission = async (role_id) => {
  if (!role_id) return null;
  const role = await prisma.hrms_d_role_permissions.findFirst({
    where: { role_id },
    select: { permissions: true },
  });
  return role ? JSON.parse(role.permissions) : null;
};
// Common method to fetch a user with role name
const getUserWithRole = async (userId, is_password = false) => {
  const user = await prisma.hrms_m_user.findUnique({
    where: { id: userId },
    select: {
      ...getUserFields(is_password),
      hrms_d_user_role: {
        select: {
          hrms_m_role: {
            select: { role_name: true, id: true },
          },
        },
      },
    },
  });

  if (!user) throw new CustomError("User not found", 404);

  const roleId = user?.hrms_d_user_role?.[0]?.hrms_m_role?.id || null;
  const permission = roleId ? await getRolePermission(roleId) : null;
  // console.log("Fetching permissions" ,roleId,JSON.parse(permission?.permissions))

  return {
    ...user,
    role: user.hrms_d_user_role?.[0]?.hrms_m_role?.role_name || null,
    permissions: permission || null,
    role_id: user.hrms_d_user_role?.[0]?.hrms_m_role?.id || null,
  };
};

const createUser = async (data) => {
  try {
    // if (data.employee_id) {
    //   const existingUser = await prisma.hrms_m_user.findFirst({
    //     where: { employee_id: Number(data.employee_id) },
    //   });
    //   if (existingUser) {
    //     return {
    //       success: false,
    //       message: "A user already exists for this employee.",
    //       status: 400,
    //     };
    //   }

    //   const employee = await prisma.hrms_d_employee.findUnique({
    //     where: { id: Number(data.employee_id) },
    //     select: {
    //       full_name: true,
    //       email: true,
    //       phone_number: true,
    //       address: true,
    //     },
    //   });

    //   if (!employee) {
    //     return {
    //       success: false,
    //       message: "Employee not found with the given ID.",
    //       status: 400,
    //     };
    //   }

    //   data.full_name = data.full_name || employee.full_name;
    //   data.email = data.email || employee.email;
    //   data.phone = data.phone || employee.phone_number;
    //   data.address = data.address || employee.address;
    // }

    const newUser = await prisma.users.create({
      data: {
        username: data.username,
        password: data.password,
        email: data.email,
        company: data.company,
        // profile_img: data.profile_img || null,
        createdby: data.createdby || 1,
        log_inst: data.log_inst || 1,
        createdate: new Date(),
      },
    });

    return newUser;
  } catch (error) {
    console.log(error);
    throw new CustomError(`Error creating user: ${error.message}`, 500);
  }
};

// Update a user and their role
const updateUser = async (id, data) => {
  try {
    if (data.employee_id) {
      const employee = await prisma.hrms_d_employee.findUnique({
        where: { id: Number(data.employee_id) },
        select: {
          full_name: true,
          email: true,
          phone_number: true,
          address: true,
        },
      });

      if (!employee) {
        throw new CustomError("Employee not found with the given ID.", 400);
      }

      data.full_name = data.full_name || employee.full_name;
      data.email = data.email || employee.email;
      data.phone = data.phone || employee.phone_number;
      data.address = data.address || employee.address;
    }

    const updateData = {
      email: data.email,
      full_name: data.full_name,
      phone: data.phone || "",
      address: data.address || "",
      profile_img: data.profile_img,
      is_active: data.is_active,
      updatedate: new Date(),
    };

    if (data.username) {
      updateData.username = data.username;
    }

    if (data.password) {
      updateData.password = data.password;
    }

    if (data.employee_id) {
      updateData.employee_id = Number(data.employee_id);
    }

    const updatedUser = await prisma.hrms_m_user.update({
      where: { id: parseInt(id) },
      data: updateData,
    });

    if (data.role_id) {
      await prisma.hrms_d_user_role.deleteMany({
        where: { user_id: updatedUser.id },
      });

      await prisma.hrms_d_user_role.create({
        data: {
          user_id: updatedUser.id,
          role_id: data.role_id,
          is_active: "Y",
          log_inst: 1,
          createdate: new Date(),
          createdby: data.updatedby || 1,
        },
      });
    }

    // Step 5: Return full user details
    return await getUserWithRole(updatedUser.id);
  } catch (error) {
    console.log(error);
    throw new CustomError(`Error updating user: ${error.message}`, 500);
  }
};

// Find a user by email and include role
const findUserByEmail = async (email) => {
  try {
    const user = await prisma.users.findFirst({
      where: { email },
    });

    if (!user) throw new CustomError("User not found", 404);
    console.log("User found", user);

    return user;
    // return await getUserWithRole(user.id, true);
  } catch (error) {
    console.log(error);
    throw new CustomError(`Error finding user by email: ${error.message}`, 503);
  }
};

// Find a user by ID and include role
const findUserById = async (id) => {
  try {
    return await prisma.users.findFirst({
      where: { id: parseInt(id) },
    });
    // return await getUserWithRole(parseInt(id));
  } catch (error) {
    throw new CustomError(`Error finding user by ID: ${error.message}`, 503);
  }
};

// Delete a user
const deleteUser = async (id) => {
  try {
    // Delete related records
    await prisma.hrms_d_user_role.deleteMany({
      where: { user_id: parseInt(id) },
    });

    await prisma.hrms_m_user.delete({
      where: { id: parseInt(id) },
    });
  } catch (error) {
    console.log(error);

    throw new CustomError(`Error deleting user: ${error.message}`, 500);
  }
};

// Get all users and include their roles
// const getAllUsers = async (search, page, size, startDate, endDate, is_active) => {
//   try {
//     page = page || 1;
//     size = size || 10;
//     const skip = (page - 1) * size;
//     const filters = {};

//     // 🔍 Search filtering
//     if (search) {
//       filters.OR = [
//         { username: { contains: search.toLowerCase() } },
//         { email: { contains: search.toLowerCase() } },
//         { full_name: { contains: search.toLowerCase() } },
//         { phone: { contains: search.toLowerCase() } },
//         { address: { contains: search.toLowerCase() } },
//       ];
//     }

//     // 📅 Date filtering
//     if (startDate && endDate) {
//       const start = new Date(startDate);
//       const end = new Date(endDate);

//       if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
//         filters.createdate = {
//           gte: start,
//           lte: end,
//         };
//       }
//     }

//     // ✅ is_active filtering
//     if (typeof is_active === "boolean") {
//       filters.is_active = is_active ? "Y" : "N";
//     } else if (typeof is_active === "string") {
//       if (is_active.toLowerCase() === "true") {
//         filters.is_active = "Y";
//       } else if (is_active.toLowerCase() === "false") {
//         filters.is_active = "N";
//       }
//     }

//     // 🔄 Fetch users
//     const usersList = await prisma.hrms_m_user.findMany({
//       where: filters,
//       skip,
//       take: size,
//       orderBy: [{ updatedate: "desc" }, { createdate: "desc" }],
//       select: {
//         ...getUserFields(),
//         hrms_d_user_role: {
//           select: {
//             hrms_m_role: { select: { role_name: true, id: true } },
//           },
//         },
//       },
//     });

//     // 📊 Count
//     const totalCount = await prisma.hrms_m_user.count({ where: filters });

//     return {
//       data: usersList,
//       currentPage: page,
//       size,
//       totalPages: Math.ceil(totalCount / size),
//       totalCount,
//     };
//   } catch (error) {
//     throw new CustomError("Error retrieving users", 503);
//   }
// };

const getAllUsers = async (
  search,
  page,
  size,
  startDate,
  endDate,
  is_active
) => {
  try {
    page = page || 1;
    size = size || 10;
    const skip = (page - 1) * size;
    const filters = {};

    if (search) {
      filters.OR = [
        { username: { contains: search.toLowerCase() } },
        { email: { contains: search.toLowerCase() } },
        { full_name: { contains: search.toLowerCase() } },
        { phone: { contains: search.toLowerCase() } },
        { address: { contains: search.toLowerCase() } },
      ];
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        filters.createdate = {
          gte: start,
          lte: end,
        };
      }
    }

    if (typeof is_active === "boolean") {
      filters.is_active = is_active ? "Y" : "N";
    } else if (typeof is_active === "string") {
      if (is_active.toLowerCase() === "true") {
        filters.is_active = "Y";
      } else if (is_active.toLowerCase() === "false") {
        filters.is_active = "N";
      }
    }

    const usersList = await prisma.hrms_m_user.findMany({
      where: filters,
      skip,
      take: size,
      orderBy: [{ updatedate: "desc" }, { createdate: "desc" }],
      select: {
        ...getUserFields(),
        hrms_d_user_role: {
          select: {
            hrms_m_role: { select: { role_name: true, id: true } },
          },
        },
      },
    });

    const totalCount = await prisma.hrms_m_user.count({ where: filters });

    return {
      data: usersList,
      currentPage: page,
      size,
      totalPages: Math.ceil(totalCount / size),
      totalCount,
    };
  } catch (error) {
    throw new CustomError("Error retrieving users", 503);
  }
};

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  updateUser,
  deleteUser,
  getAllUsers,
};
