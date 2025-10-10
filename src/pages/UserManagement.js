import React, { useState, useEffect } from 'react';
import { db, collection, onSnapshot, query, doc, updateDoc, deleteDoc } from '../services/firebase';
import { auth, createUserWithEmailAndPassword, setDoc } from '../services/firebase';
import Spinner from '../components/common/Spinner';
import Modal from '../components/common/Modal';
import { Trash2, Edit, PlusCircle } from 'lucide-react';

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // State for modals
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    
    // State for forms
    const [editRole, setEditRole] = useState('');
    const [editClassName, setEditClassName] = useState('');
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserPassword, setNewUserPassword] = useState('');
    const [newUserRole, setNewUserRole] = useState('student');
    const [newUserClassName, setNewUserClassName] = useState('SS1'); // Default class

    useEffect(() => {
        const usersQuery = query(collection(db, "users"));
        const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
            const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setUsers(usersList);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // --- Modal Handling ---
    const openEditModal = (user) => {
        setSelectedUser(user);
        setEditRole(user.role);
        setEditClassName(user.className || ''); // Handle users that might not have a class yet
        setIsEditModalOpen(true);
    };

    const openDeleteModal = (user) => {
        setSelectedUser(user);
        setIsDeleteModalOpen(true);
    };
    
    const openAddUserModal = () => {
        setNewUserEmail('');
        setNewUserPassword('');
        setNewUserRole('student');
        setNewUserClassName('SS1');
        setIsAddUserModalOpen(true);
    };

    const closeModal = () => {
        setIsEditModalOpen(false);
        setIsDeleteModalOpen(false);
        setIsAddUserModalOpen(false);
        setSelectedUser(null);
    };

    // --- Core Actions ---
    const handleCreateUser = async () => {
        if (!newUserEmail || !newUserPassword) {
            alert("Please provide an email and password.");
            return;
        }
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, newUserEmail, newUserPassword);
            const user = userCredential.user;

            const userDocRef = doc(db, "users", user.uid);
            await setDoc(userDocRef, {
                uid: user.uid,
                email: user.email,
                role: newUserRole,
                className: newUserClassName, // Save the class name
                createdAt: new Date()
            });
        } catch (error) {
            console.error("Error creating new user:", error);
            alert(`Failed to create user: ${error.message}`);
        } finally {
            closeModal();
        }
    };

    const handleUpdateUser = async () => {
        if (!selectedUser) return;

        const userRef = doc(db, "users", selectedUser.id);
        try {
            await updateDoc(userRef, { 
                role: editRole,
                className: editClassName 
            });
        } catch (error) {
            console.error("Error updating user:", error);
            alert("Failed to update user. Please try again.");
        } finally {
            closeModal();
        }
    };

    const handleDeleteUser = async () => {
        if (!selectedUser) return;
        try {
            await deleteDoc(doc(db, "users", selectedUser.id));
        } catch (error) {
            console.error("Error deleting user document:", error);
            alert("Failed to delete user.");
        } finally {
            closeModal();
        }
    };

    const filteredUsers = users.filter(user =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return <div className="flex justify-center items-center h-64"><Spinner /></div>;
    }

    return (
        <div className="bg-white p-6 md:p-8 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold text-gray-800">User Management</h1>
                <button 
                    onClick={openAddUserModal}
                    className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center"
                >
                    <PlusCircle size={18} className="mr-2" />
                    New User
                </button>
            </div>
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Search by email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full md:w-1/3 p-2 border border-gray-300 rounded-md"
                />
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Role</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Class</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredUsers.map(user => (
                            <tr key={user.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.email}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{user.role}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.className || 'N/A'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <div className="flex items-center space-x-4">
                                        <button onClick={() => openEditModal(user)} className="text-blue-600 hover:text-blue-900" title="Edit User">
                                            <Edit size={18} />
                                        </button>
                                        <button onClick={() => openDeleteModal(user)} className="text-red-600 hover:text-red-900" title="Delete User">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal for Adding a New User */}
            <Modal isOpen={isAddUserModalOpen} onClose={closeModal} title="Add New User">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                        <input type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                        <input type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                        <select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md bg-white">
                            <option value="student">Student</option>
                            <option value="teacher">Teacher</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                        <select value={newUserClassName} onChange={(e) => setNewUserClassName(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md bg-white">
                            <option value="SS1">SS1</option>
                            <option value="SS2">SS2</option>
                            <option value="SS3">SS3</option>
                        </select>
                    </div>
                </div>
                <div className="flex justify-end space-x-4 mt-6">
                    <button onClick={closeModal} className="px-4 py-2 bg-gray-200 rounded-lg">Cancel</button>
                    <button onClick={handleCreateUser} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Create User</button>
                </div>
            </Modal>

            {/* Modal for Editing User */}
            <Modal isOpen={isEditModalOpen} onClose={closeModal} title="Edit User">
                <p>Editing user: <strong>{selectedUser?.email}</strong>.</p>
                <div className="space-y-4 mt-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                        <select value={editRole} onChange={(e) => setEditRole(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md bg-white">
                            <option value="student">Student</option>
                            <option value="teacher">Teacher</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                        <select value={editClassName} onChange={(e) => setEditClassName(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md bg-white">
                            <option value="">No Class</option>
                            <option value="SS1">SS1</option>
                            <option value="SS2">SS2</option>
                            <option value="SS3">SS3</option>
                        </select>
                    </div>
                </div>
                <div className="flex justify-end space-x-4 mt-6">
                    <button onClick={closeModal} className="px-4 py-2 bg-gray-200 rounded-lg">Cancel</button>
                    <button onClick={handleUpdateUser} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Save Changes</button>
                </div>
            </Modal>

            {/* Modal for Deleting User */}
            <Modal isOpen={isDeleteModalOpen} onClose={closeModal} title="Confirm Deletion">
                <p>Are you sure you want to delete the user <strong>{selectedUser?.email}</strong>?</p>
                <div className="flex justify-end space-x-4 mt-6">
                    <button onClick={closeModal} className="px-4 py-2 bg-gray-200 rounded-lg">Cancel</button>
                    <button onClick={handleDeleteUser} className="px-4 py-2 bg-red-600 text-white rounded-lg">Delete User</button>
                </div>
            </Modal>
        </div>
    );
};

export default UserManagement;
