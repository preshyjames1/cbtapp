import React, { useState, useEffect, useRef } from 'react';
import { db, collection, onSnapshot, query, doc, updateDoc, deleteDoc, secondaryAuth } from '../services/firebase';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { setDoc } from 'firebase/firestore';
import Spinner from '../components/common/Spinner';
import Modal from '../components/common/Modal';
import { Trash2, Edit, PlusCircle, Upload, Users, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import toast from 'react-hot-toast';

const CLASS_OPTIONS = ['JSS1','JSS2','JSS3','SS1','SS2','SS3'];
const CLASS_ORDER   = Object.fromEntries(CLASS_OPTIONS.map((c, i) => [c, i]));

const UserManagement = () => {
    const [users,        setUsers]        = useState([]);
    const [loading,      setLoading]      = useState(true);
    const [searchTerm,   setSearchTerm]   = useState('');
    const [sortKey,      setSortKey]      = useState('name');
    const [sortDir,      setSortDir]      = useState('asc');

    // Modal state
    const [isEditModalOpen,   setIsEditModalOpen]   = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isAddModalOpen,    setIsAddModalOpen]    = useState(false);
    const [addTab,            setAddTab]            = useState('single');
    const [selectedUser,      setSelectedUser]      = useState(null);
    const [actionLoading,     setActionLoading]     = useState(false);

    // Add-user form
    const [newName,      setNewName]      = useState('');
    const [newEmail,     setNewEmail]     = useState('');
    const [newPassword,  setNewPassword]  = useState('');
    const [newRole,      setNewRole]      = useState('student');
    const [newClassName, setNewClassName] = useState('SS1');

    // Edit-user form
    const [editName,      setEditName]      = useState('');
    const [editEmail,     setEditEmail]     = useState('');
    const [editPassword,  setEditPassword]  = useState('');
    const [editRole,      setEditRole]      = useState('');
    const [editClassName, setEditClassName] = useState('');

    // Bulk import
    const [bulkText,    setBulkText]    = useState('');
    const [bulkPreview, setBulkPreview] = useState([]);
    const [bulkErrors,  setBulkErrors]  = useState([]);
    const fileRef = useRef();

    // Pagination
    const USERS_PER_PAGE = 15;
    const [currentPage, setCurrentPage] = useState(1);
    useEffect(() => setCurrentPage(1), [searchTerm, sortKey, sortDir]);

    useEffect(() => {
        const unsub = onSnapshot(query(collection(db, 'users')), snap => {
            setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        });
        return () => unsub();
    }, []);

    // ── Helpers ───────────────────────────────────────────────────────────────
    const resetAddForm = () => {
        setNewName(''); setNewEmail(''); setNewPassword('');
        setNewRole('student'); setNewClassName('SS1');
        setBulkText(''); setBulkPreview([]); setBulkErrors([]);
        setAddTab('single');
    };
    const closeModal = () => {
        setIsEditModalOpen(false); setIsDeleteModalOpen(false); setIsAddModalOpen(false);
        setSelectedUser(null); resetAddForm();
        setEditPassword('');
    };

    // ── Sort ──────────────────────────────────────────────────────────────────
    const handleSort = (key) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('asc'); }
    };

    const SortIcon = ({ col }) => {
        if (sortKey !== col) return <ChevronsUpDown size={13} className="ml-1 text-gray-400 inline" />;
        return sortDir === 'asc'
            ? <ChevronUp size={13} className="ml-1 text-blue-600 inline" />
            : <ChevronDown size={13} className="ml-1 text-blue-600 inline" />;
    };

    const SortTh = ({ col, label }) => (
        <th onClick={() => handleSort(col)}
            className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer select-none hover:bg-gray-200">
            {label}<SortIcon col={col} />
        </th>
    );

    // ── Filter + Sort + Paginate ──────────────────────────────────────────────
    const filtered = users.filter(u => {
        const t = searchTerm.toLowerCase();
        return (u.name||'').toLowerCase().includes(t) || (u.email||'').toLowerCase().includes(t);
    });

    const sorted = [...filtered].sort((a, b) => {
        let av, bv;
        if (sortKey === 'class') {
            av = CLASS_ORDER[a.className] ?? 99;
            bv = CLASS_ORDER[b.className] ?? 99;
        } else {
            av = (a[sortKey] || '').toLowerCase();
            bv = (b[sortKey] || '').toLowerCase();
        }
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ?  1 : -1;
        return 0;
    });

    const totalPages = Math.ceil(sorted.length / USERS_PER_PAGE);
    const paged      = sorted.slice((currentPage - 1) * USERS_PER_PAGE, currentPage * USERS_PER_PAGE);

    // ── Create single user ────────────────────────────────────────────────────
    const createOneUser = async (name, email, password, role, className) => {
        const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        const uid = credential.user.uid;
        await signOut(secondaryAuth);
        await setDoc(doc(db, 'users', uid), { uid, name: name.trim(), email, role, className, createdAt: new Date() });
    };

    const handleCreateUser = async () => {
        if (!newName.trim() || !newEmail || !newPassword) { toast.error('Please fill in name, email and password.'); return; }
        setActionLoading(true);
        try {
            await createOneUser(newName, newEmail, newPassword, newRole, newClassName);
            toast.success(`User "${newName}" created!`);
            closeModal();
        } catch (err) { toast.error(`Failed: ${err.message}`); }
        finally { setActionLoading(false); }
    };

    // ── Bulk import ───────────────────────────────────────────────────────────
    const parseBulkCSV = (text) => {
        const rows = text.trim().split('\n').filter(Boolean);
        const parsed = [], errors = [];
        rows.forEach((row, i) => {
            const cols = row.split(',').map(c => c.trim());
            if (cols.length < 3) { errors.push(`Row ${i+1}: needs name, email, password`); return; }
            const [name, email, password, role='student', className='SS1'] = cols;
            if (!name) { errors.push(`Row ${i+1}: name empty`); return; }
            if (!email.includes('@')) { errors.push(`Row ${i+1}: invalid email`); return; }
            if (password.length < 6) { errors.push(`Row ${i+1}: password too short`); return; }
            parsed.push({ name, email, password, role, className });
        });
        return { parsed, errors };
    };
    const handleBulkTextChange = (text) => {
        setBulkText(text);
        if (!text.trim()) { setBulkPreview([]); setBulkErrors([]); return; }
        const { parsed, errors } = parseBulkCSV(text);
        setBulkPreview(parsed); setBulkErrors(errors);
    };
    const handleFileUpload = (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => handleBulkTextChange(ev.target.result);
        reader.readAsText(file);
    };
    const handleBulkCreate = async () => {
        if (!bulkPreview.length) { toast.error('No valid rows.'); return; }
        setActionLoading(true);
        let ok = 0, fail = 0;
        for (const u of bulkPreview) {
            try { await createOneUser(u.name, u.email, u.password, u.role, u.className); ok++; }
            catch (err) { fail++; console.error(`Failed ${u.email}:`, err.message); }
        }
        setActionLoading(false);
        toast.success(`Imported ${ok}${fail > 0 ? `, ${fail} failed` : ''} user(s).`);
        closeModal();
    };

    // ── Edit user ─────────────────────────────────────────────────────────────
    const openEditModal = (user) => {
        setSelectedUser(user);
        setEditName(user.name || '');
        setEditEmail(user.email || '');
        setEditPassword('');
        setEditRole(user.role || 'student');
        setEditClassName(user.className || '');
        setIsEditModalOpen(true);
    };

    const handleUpdateUser = async () => {
        if (!selectedUser) return;
        setActionLoading(true);
        try {
            // Update Firestore profile
            const updates = { name: editName.trim(), role: editRole, className: editClassName };
            if (editEmail.trim() !== selectedUser.email) updates.email = editEmail.trim();
            await updateDoc(doc(db, 'users', selectedUser.id), updates);

            // Note: Changing a user's Firebase Auth email/password requires either
            // their current password or a Cloud Function with admin SDK.
            // Admins can use Firebase Console → Authentication → find user → Reset Password.
            if (editEmail.trim() !== selectedUser.email) {
                toast('Profile email updated. To also change their login email, use Firebase Console → Authentication.', { icon: 'ℹ️', duration: 5000 });
            }
            if (editPassword.trim() && editPassword.length >= 6) {
                toast('To reset a password, use Firebase Console → Authentication → find user → Send Password Reset Email.', { icon: '🔑', duration: 6000 });
            }

            toast.success('Profile updated successfully.');
            closeModal();
        } catch (err) { toast.error(`Failed: ${err.message}`); }
        finally { setActionLoading(false); }
    };

    // ── Delete user ───────────────────────────────────────────────────────────
    const openDeleteModal = (user) => { setSelectedUser(user); setIsDeleteModalOpen(true); };
    const handleDeleteUser = async () => {
        if (!selectedUser) return;
        setActionLoading(true);
        try {
            await deleteDoc(doc(db, 'users', selectedUser.id));
            toast.success('User profile deleted.');
            closeModal();
        } catch (err) { toast.error(`Failed: ${err.message}`); }
        finally { setActionLoading(false); }
    };

    if (loading) return <div className="flex justify-center items-center h-64"><Spinner /></div>;

    return (
        <div className="bg-white p-6 md:p-8 rounded-lg shadow-lg">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold text-gray-800">User Management</h1>
                <button onClick={() => setIsAddModalOpen(true)}
                    className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2">
                    <PlusCircle size={18} /> Add User
                </button>
            </div>

            {/* Search + count */}
            <div className="flex items-center gap-4 mb-4">
                <input type="text" placeholder="Search by name or email…" value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full md:w-1/3 p-2 border border-gray-300 rounded-md" />
                <span className="text-sm text-gray-400 whitespace-nowrap">{sorted.length} user{sorted.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                        <tr>
                            <SortTh col="name"      label="Name" />
                            <SortTh col="email"     label="Email" />
                            <SortTh col="role"      label="Role" />
                            <SortTh col="class"     label="Class" />
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {paged.length === 0 ? (
                            <tr><td colSpan="5" className="text-center py-10 text-gray-400">No users found.</td></tr>
                        ) : paged.map(user => (
                            <tr key={user.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                    {user.name || <span className="text-gray-400 italic">No name</span>}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{user.email}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                        user.role === 'admin'   ? 'bg-purple-100 text-purple-700' :
                                        user.role === 'teacher' ? 'bg-blue-100 text-blue-700' :
                                                                   'bg-green-100 text-green-700'
                                    }`}>{user.role}</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.className || '—'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <div className="flex items-center gap-4">
                                        <button onClick={() => openEditModal(user)} className="text-blue-600 hover:text-blue-900" title="Edit"><Edit size={18} /></button>
                                        <button onClick={() => openDeleteModal(user)} className="text-red-600 hover:text-red-900" title="Delete"><Trash2 size={18} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-between items-center mt-4 text-sm">
                    <p className="text-gray-500">
                        Showing {(currentPage-1)*USERS_PER_PAGE+1}–{Math.min(currentPage*USERS_PER_PAGE, sorted.length)} of {sorted.length}
                    </p>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage===1}
                            className="px-3 py-1 border rounded-md disabled:opacity-40 hover:bg-gray-50">Previous</button>
                        {Array.from({length: totalPages}, (_, i) => i+1).map(pg => (
                            <button key={pg} onClick={() => setCurrentPage(pg)}
                                className={`w-8 h-8 rounded-md font-medium ${pg===currentPage ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 text-gray-600'}`}>
                                {pg}
                            </button>
                        ))}
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage===totalPages}
                            className="px-3 py-1 border rounded-md disabled:opacity-40 hover:bg-gray-50">Next</button>
                    </div>
                </div>
            )}

            {/* ── Add User Modal ── */}
            <Modal isOpen={isAddModalOpen} onClose={closeModal} title="Add User">
                <div className="flex border-b mb-5">
                    {[['single','Single User'],['bulk','Bulk Import (CSV)']].map(([key, label]) => (
                        <button key={key} onClick={() => setAddTab(key)}
                            className={`px-4 py-2 text-sm font-semibold border-b-2 transition -mb-px ${addTab===key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                            {label}
                        </button>
                    ))}
                </div>

                {addTab === 'single' ? (
                    <div className="space-y-4">
                        <LabeledInput label="Full Name" type="text"     value={newName}     onChange={e => setNewName(e.target.value)}     placeholder="e.g. Amara Johnson" />
                        <LabeledInput label="Email"     type="email"    value={newEmail}    onChange={e => setNewEmail(e.target.value)}    placeholder="e.g. amara@school.edu" />
                        <LabeledInput label="Password"  type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min. 6 characters" />
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                            <select value={newRole} onChange={e => setNewRole(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md bg-white">
                                <option value="student">Student</option>
                                <option value="teacher">Teacher</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                            <select value={newClassName} onChange={e => setNewClassName(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md bg-white">
                                {CLASS_OPTIONS.map(c => <option key={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={closeModal} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Cancel</button>
                            <button onClick={handleCreateUser} disabled={actionLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50 flex items-center gap-2">
                                {actionLoading ? <Spinner /> : 'Create User'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600">
                            Paste CSV rows or upload a file. Format: <code className="bg-gray-100 px-1 rounded text-xs">name, email, password, role, class</code>
                        </p>
                        <textarea className="w-full p-2 border border-gray-300 rounded-md text-sm font-mono h-32 resize-none"
                            placeholder={"Amara Johnson, amara@school.edu, pass123, student, SS1\nTunde Okon, tunde@school.edu, pass123, student, SS2"}
                            value={bulkText} onChange={e => handleBulkTextChange(e.target.value)} />
                        <div className="flex items-center gap-3">
                            <input type="file" accept=".csv,.txt" ref={fileRef} className="hidden" onChange={handleFileUpload} />
                            <button onClick={() => fileRef.current.click()} className="flex items-center gap-2 px-3 py-1.5 border rounded text-sm text-gray-600 hover:bg-gray-50">
                                <Upload size={14} /> Upload CSV
                            </button>
                            <span className="text-xs text-gray-400">{bulkPreview.length} valid row(s)</span>
                        </div>
                        {bulkErrors.length > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-600 space-y-1">
                                {bulkErrors.map((e,i) => <p key={i}>⚠ {e}</p>)}
                            </div>
                        )}
                        {bulkPreview.length > 0 && (
                            <div className="overflow-x-auto max-h-40 border rounded">
                                <table className="min-w-full text-xs">
                                    <thead className="bg-gray-50"><tr>
                                        {['Name','Email','Role','Class'].map(h => <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500">{h}</th>)}
                                    </tr></thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {bulkPreview.map((u,i) => (
                                            <tr key={i}>
                                                <td className="px-3 py-1.5">{u.name}</td>
                                                <td className="px-3 py-1.5">{u.email}</td>
                                                <td className="px-3 py-1.5 capitalize">{u.role}</td>
                                                <td className="px-3 py-1.5">{u.className}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={closeModal} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Cancel</button>
                            <button onClick={handleBulkCreate} disabled={actionLoading || !bulkPreview.length}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50 flex items-center gap-2">
                                {actionLoading ? <Spinner /> : <><Users size={14}/> Import {bulkPreview.length} User(s)</>}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* ── Edit User Modal ── */}
            <Modal isOpen={isEditModalOpen} onClose={closeModal} title="Edit User">
                <div className="space-y-4">
                    <LabeledInput label="Full Name" type="text"  value={editName}  onChange={e => setEditName(e.target.value)} />
                    <div>
                        <LabeledInput label="Email Address" type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} />
                        <p className="text-xs text-gray-400 mt-1">Updating email here updates the Firestore profile. To change their login email, use Firebase Console → Authentication.</p>
                    </div>
                    <div>
                        <LabeledInput label="New Password (optional)" type="password" value={editPassword}
                            onChange={e => setEditPassword(e.target.value)} placeholder="Leave blank to keep current password" />
                        <p className="text-xs text-gray-400 mt-1">Password changes require Firebase Console → Authentication → find user → Send Password Reset Email.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                        <select value={editRole} onChange={e => setEditRole(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md bg-white">
                            <option value="student">Student</option>
                            <option value="teacher">Teacher</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                        <select value={editClassName} onChange={e => setEditClassName(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md bg-white">
                            <option value="">No Class</option>
                            {CLASS_OPTIONS.map(c => <option key={c}>{c}</option>)}
                        </select>
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={closeModal} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Cancel</button>
                    <button onClick={handleUpdateUser} disabled={actionLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
                        {actionLoading ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            </Modal>

            {/* ── Delete Modal ── */}
            <Modal isOpen={isDeleteModalOpen} onClose={closeModal} title="Confirm Deletion">
                <p>Delete <strong>{selectedUser?.name || selectedUser?.email}</strong>? This removes their Firestore profile. Their login account remains in Firebase Auth.</p>
                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={closeModal} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Cancel</button>
                    <button onClick={handleDeleteUser} disabled={actionLoading} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm disabled:opacity-50">
                        {actionLoading ? 'Deleting…' : 'Delete'}
                    </button>
                </div>
            </Modal>
        </div>
    );
};

const LabeledInput = ({ label, ...props }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <input {...props} className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400" />
    </div>
);

export default UserManagement;