import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import TemplateDropdown from "../shared/TemplateDropdown";
import UserDropdown from "../shared/UserDropdown";
import { getTemplatesDropdown, getUserPermissions, saveUserPermissions } from "../../services/permissionsApi";
import { getUsers } from "../../services/userApi";
import { toast } from "../shared/Toast";
import "./Permissions.css";

function Permissions({ onLogout }) {
  const navigate = useNavigate();

  // State structure: {<userId>: {isAdmin: bool, permissions: {<templateId>: {"all": bool, "view": bool, "create": bool, "edit": bool}}}}
  const [permissionsData, setPermissionsData] = useState({});

  // Track insertion order
  const [userIdsOrder, setUserIdsOrder] = useState([]);
  const [templateOrder, setTemplateOrder] = useState({}); // {userId: [templateId1, templateId2, ...]}

  // Track user data (id -> {id, name, email}) for display
  const [userData, setUserData] = useState({}); // {userId: {id, name, email}}

  // Templates from API
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [saving, setSaving] = useState(false);

  // Use order arrays instead of Object.keys
  const userIds = userIdsOrder;

  // Fetch templates and permissions on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch templates
        setLoadingTemplates(true);
        const templatesData = await getTemplatesDropdown();
        setTemplates(templatesData);

        // Fetch existing permissions
        setLoadingPermissions(true);
        const permissionsData = await getUserPermissions();

        if (permissionsData && Object.keys(permissionsData).length > 0) {
          setPermissionsData(permissionsData);

          // Build order arrays from fetched data
          const userIds = Object.keys(permissionsData);
          setUserIdsOrder(userIds);

          const templateOrderMap = {};
          userIds.forEach(userId => {
            const userPermissions = permissionsData[userId]?.permissions || {};
            templateOrderMap[userId] = Object.keys(userPermissions);
          });
          setTemplateOrder(templateOrderMap);

          // Fetch user data for existing users
          const userDataMap = {};
          for (const userId of userIds) {
            try {
              // Fetch user by searching for their ID
              const users = await getUsers(userId);
              if (users && users.length > 0) {
                const user = users[0];
                userDataMap[userId] = {
                  id: user.id,
                  name: user.name,
                  email: user.email
                };
              }
            } catch (error) {
              console.error(`Error fetching user ${userId}:`, error);
              // Keep default display if user fetch fails
            }
          }
          setUserData(userDataMap);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load data");
        setTemplates([]);
      } finally {
        setLoadingTemplates(false);
        setLoadingPermissions(false);
      }
    };

    fetchData();
  }, []);

  const handleAddUser = (user) => {
    if (!user || !user.id) {
      return;
    }

    const userId = String(user.id);

    // Check if user already exists
    if (permissionsData[userId]) {
      alert("User already exists!");
      return;
    }

    // Initialize user with empty templates and isAdmin false
    setPermissionsData((prev) => ({
      ...prev,
      [userId]: {
        isAdmin: false,
        permissions: {}
      }
    }));

    // Track user order
    setUserIdsOrder((prev) => [...prev, userId]);
    setTemplateOrder((prev) => ({
      ...prev,
      [userId]: []
    }));

    // Store user data for display
    setUserData((prev) => ({
      ...prev,
      [userId]: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    }));
  };

  const handleTemplateSelect = (userId, template) => {
    setPermissionsData((prev) => {
      const newData = { ...prev };

      if (!newData[userId]) {
        newData[userId] = {
          isAdmin: false,
          permissions: {}
        };
      }

      if (!newData[userId].permissions) {
        newData[userId].permissions = {};
      }

      if (!newData[userId].permissions[template.id]) {
        newData[userId].permissions[template.id] = {
          all: false,
          view: false,
          create: false,
          edit: false,
        };
      }

      return newData;
    });

    // Track template order
    setTemplateOrder((prev) => ({
      ...prev,
      [userId]: [...(prev[userId] || []), template.id]
    }));
  };

  const handlePermissionChange = (userId, templateId, permission) => {
    setPermissionsData((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        permissions: {
          ...prev[userId].permissions,
          [templateId]: {
            ...prev[userId].permissions[templateId],
            [permission]: !prev[userId].permissions[templateId][permission]
          }
        }
      }
    }));
  };

  const handleAdminToggle = (userId) => {
    setPermissionsData((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        isAdmin: !prev[userId].isAdmin
      }
    }));
  };

  const handleRemoveUser = (userId) => {
    setPermissionsData((prev) => {
      const newData = { ...prev };
      delete newData[userId];
      return newData;
    });

    // Remove from order tracking
    setUserIdsOrder((prev) => prev.filter(id => id !== userId));
    setTemplateOrder((prev) => {
      const newOrder = { ...prev };
      delete newOrder[userId];
      return newOrder;
    });
  };

  const handleRemoveTemplate = (userId, templateId) => {
    setPermissionsData((prev) => {
      const newData = { ...prev };

      if (newData[userId]?.permissions) {
        const userPermissions = { ...newData[userId].permissions };
        delete userPermissions[templateId];
        newData[userId] = {
          ...newData[userId],
          permissions: userPermissions
        };
      }

      return newData;
    });

    // Remove from template order
    setTemplateOrder((prev) => {
      const newOrder = { ...prev };
      if (newOrder[userId]) {
        newOrder[userId] = newOrder[userId].filter(id => id !== templateId);
      }
      return newOrder;
    });
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);

      // Save permissions
      await saveUserPermissions(permissionsData);
      toast.success("Permissions saved successfully");
      console.log("Permissions Data:", permissionsData);

      // Refetch templates to ensure sync with server
      const templatesData = await getTemplatesDropdown();
      setTemplates(templatesData);
    } catch (error) {
      console.error("Error saving permissions:", error);
      toast.error("Failed to save permissions");
    } finally {
      setSaving(false);
    }
  };

  const getSelectedTemplatesForUser = (userId) => {
    const userPermissions = permissionsData[userId]?.permissions || {};
    return Object.keys(userPermissions);
  };

  const getTemplateName = (templateId) => {
    if (loadingTemplates || templates.length === 0) {
      return templateId;
    }
    const template = templates.find(t => t.id == templateId);
    if (!template) return templateId;
    return template.version
      ? `${template.template_name} (v${template.version})`
      : template.template_name;
  };

  const getUserDisplayName = (userId) => {
    const user = userData[userId];
    if (!user) return `User ${userId}`;
    return user.name || `User ${userId}`;
  };

  // Build table rows
  const buildTableRows = () => {
    const rows = [];

    // Add rows for existing users
    userIds.forEach((userId) => {
      const userData = permissionsData[userId] || { isAdmin: false, permissions: {} };
      const userPermissions = userData.permissions || {};
      const templateIds = templateOrder[userId] || [];
      const totalRows = templateIds.length + 1; // +1 for dropdown row

      // Add template rows
      templateIds.forEach((templateId, index) => {
        rows.push({
          type: "template",
          userId,
          templateId,
          isFirstRow: index === 0,
          rowSpan: totalRows,
          permissions: userPermissions[templateId],
          isAdmin: userData.isAdmin,
        });
      });

      // Add dropdown row
      rows.push({
        type: "dropdown",
        userId,
        isFirstRow: templateIds.length === 0,
        rowSpan: totalRows,
        isAdmin: userData.isAdmin,
      });
    });

    // Add new user input row
    rows.push({
      type: "new-user",
    });

    return rows;
  };

  const rows = buildTableRows();

  if (loadingPermissions || loadingTemplates) {
    return (
      <div className="permissions-container">
        <div className="permissions-header">
          <div>
            <h1>User Permissions</h1>
            <div className="header-actions">
              <button onClick={() => navigate('/home')} className="back-button">
                <ArrowLeft size={16} />
                <span>Back to Home</span>
              </button>
              <button onClick={onLogout} className="logout-button">
                Logout
              </button>
            </div>
          </div>
        </div>
        <div className="permissions-content">
          <div className="loading-container">
            <div className="loading-text">
              {loadingTemplates ? "Loading templates..." : "Loading permissions..."}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="permissions-container">
      <div className="permissions-header">
        <div>
          <h1>User Permissions</h1>
          <div className="header-actions">
            <button onClick={() => navigate('/home')} className="back-button">
              <ArrowLeft size={16} />
              <span>Back to Home</span>
            </button>
            <button onClick={onLogout} className="logout-button">
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="permissions-content">
        <div className="table-container">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="col-user-id">User</TableHead>
                <TableHead className="col-admin">Admin</TableHead>
                <TableHead className="col-template-name">Template Name</TableHead>
                <TableHead className="col-permissions">Permissions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, rowIndex) => {
                if (row.type === "new-user") {
                  return (
                    <TableRow key="new-user">
                      <TableCell>
                        <div className="user-dropdown-container">
                          <UserDropdown
                            placeholder="Search and select user..."
                            onSelect={handleAddUser}
                            excludeIds={userIds}
                          />
                        </div>
                      </TableCell>
                      <TableCell colSpan="3" className="empty-cell">
                        <span className="empty-text">Search and select a user to start</span>
                      </TableCell>
                    </TableRow>
                  );
                } else if (row.type === "template") {
                  return (
                    <TableRow key={`${row.userId}-${row.templateId}`}>
                      {row.isFirstRow && (
                        <>
                          <TableCell rowSpan={row.rowSpan} className="user-id-cell">
                            <div className="user-id-display-container">
                              <span className="user-id-number">{getUserDisplayName(row.userId)}</span>
                              <button
                                className="remove-user-btn"
                                onClick={() => handleRemoveUser(row.userId)}
                                title="Remove user"
                              >
                                ×
                              </button>
                            </div>
                          </TableCell>
                          <TableCell rowSpan={row.rowSpan} className="admin-cell">
                            <label className="admin-checkbox">
                              <input
                                type="checkbox"
                                checked={row.isAdmin}
                                onChange={() => handleAdminToggle(row.userId)}
                              />
                            </label>
                          </TableCell>
                        </>
                      )}
                      <TableCell>
                        <div className="template-name-with-remove">
                          <span className="template-name-text">
                            {getTemplateName(row.templateId)}
                          </span>
                          <button
                            className="remove-template-btn"
                            onClick={() => handleRemoveTemplate(row.userId, row.templateId)}
                            title="Remove template"
                          >
                            ×
                          </button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="permissions-checkboxes">
                          <label className="permission-checkbox">
                            <input
                              type="checkbox"
                              checked={row.permissions.all}
                              onChange={() =>
                                handlePermissionChange(row.userId, row.templateId, "all")
                              }
                            />
                            <span>All</span>
                          </label>
                          <label className="permission-checkbox">
                            <input
                              type="checkbox"
                              checked={row.permissions.view}
                              onChange={() =>
                                handlePermissionChange(row.userId, row.templateId, "view")
                              }
                            />
                            <span>View</span>
                          </label>
                          <label className="permission-checkbox">
                            <input
                              type="checkbox"
                              checked={row.permissions.create}
                              onChange={() =>
                                handlePermissionChange(row.userId, row.templateId, "create")
                              }
                            />
                            <span>Create</span>
                          </label>
                          <label className="permission-checkbox">
                            <input
                              type="checkbox"
                              checked={row.permissions.edit}
                              onChange={() =>
                                handlePermissionChange(row.userId, row.templateId, "edit")
                              }
                            />
                            <span>Edit</span>
                          </label>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                } else if (row.type === "dropdown") {
                  return (
                    <TableRow key={`dropdown-${row.userId}`} className="dropdown-row">
                      {row.isFirstRow && (
                        <>
                          <TableCell rowSpan={row.rowSpan} className="user-id-cell">
                            <div className="user-id-display-container">
                              <span className="user-id-number">{getUserDisplayName(row.userId)}</span>
                              <button
                                className="remove-user-btn"
                                onClick={() => handleRemoveUser(row.userId)}
                                title="Remove user"
                              >
                                ×
                              </button>
                            </div>
                          </TableCell>
                          <TableCell rowSpan={row.rowSpan} className="admin-cell">
                            <label className="admin-checkbox">
                              <input
                                type="checkbox"
                                checked={row.isAdmin}
                                onChange={() => handleAdminToggle(row.userId)}
                              />
                            </label>
                          </TableCell>
                        </>
                      )}
                      <TableCell className="dropdown-cell">
                        {loadingTemplates ? (
                          <div className="loading-text">Loading templates...</div>
                        ) : (
                          <TemplateDropdown
                            placeholder="Select template..."
                            templates={templates}
                            onSelect={(template) => handleTemplateSelect(row.userId, template)}
                            excludeIds={getSelectedTemplatesForUser(row.userId)}
                          />
                        )}
                      </TableCell>
                      <TableCell className="empty-cell">
                        <span className="empty-text">Select a template</span>
                      </TableCell>
                    </TableRow>
                  );
                }
              })}

              {rows.length === 1 && (
                <TableRow>
                  <TableCell colSpan="4" className="empty-cell">
                    <span className="empty-text">No users added yet. Search and select a user to start.</span>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="permissions-footer">
        <div>
          <button onClick={handleSubmit} className="submit-button" disabled={saving}>
            {saving ? "Saving..." : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Permissions;
