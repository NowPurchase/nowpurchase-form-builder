import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import TemplateDropdown from "../shared/TemplateDropdown";
import { getTemplatesDropdown, getUserPermissions, saveUserPermissions } from "../../services/permissionsApi";
import { toast } from "../shared/Toast";
import "./Permissions.css";

function Permissions({ onLogout }) {
  // State structure: {<userId>: {<templateId>: {"all": bool, "view": bool, "create": bool, "edit": bool}}}
  const [permissionsData, setPermissionsData] = useState({});

  // Track insertion order
  const [userIdsOrder, setUserIdsOrder] = useState([]);
  const [templateOrder, setTemplateOrder] = useState({}); // {userId: [templateId1, templateId2, ...]}

  // Track new user ID being entered
  const [newUserId, setNewUserId] = useState("");

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
            const userTemplates = permissionsData[userId] || {};
            templateOrderMap[userId] = Object.keys(userTemplates);
          });
          setTemplateOrder(templateOrderMap);
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

  const handleAddUserId = () => {
    if (!newUserId || newUserId.trim() === "") {
      return;
    }

    const userId = newUserId.trim();

    // Check if user already exists
    if (permissionsData[userId]) {
      alert("User ID already exists!");
      return;
    }

    // Initialize user with empty templates
    setPermissionsData((prev) => ({
      ...prev,
      [userId]: {}
    }));

    // Track user order
    setUserIdsOrder((prev) => [...prev, userId]);
    setTemplateOrder((prev) => ({
      ...prev,
      [userId]: []
    }));

    setNewUserId("");
  };

  const handleTemplateSelect = (userId, template) => {
    setPermissionsData((prev) => {
      const newData = { ...prev };

      if (!newData[userId]) {
        newData[userId] = {};
      }

      if (!newData[userId][template.id]) {
        newData[userId][template.id] = {
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
        [templateId]: {
          ...prev[userId][templateId],
          [permission]: !prev[userId][templateId][permission]
        }
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

      if (newData[userId]) {
        const userTemplates = { ...newData[userId] };
        delete userTemplates[templateId];
        newData[userId] = userTemplates;
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

      // Refetch data to ensure sync with server
      const [templatesData, refreshedPermissions] = await Promise.all([
        getTemplatesDropdown(),
        getUserPermissions()
      ]);

      // Update templates
      setTemplates(templatesData);

      // Update permissions and rebuild order arrays
      if (refreshedPermissions && Object.keys(refreshedPermissions).length > 0) {
        setPermissionsData(refreshedPermissions);

        const userIds = Object.keys(refreshedPermissions);
        setUserIdsOrder(userIds);

        const templateOrderMap = {};
        userIds.forEach(userId => {
          const userTemplates = refreshedPermissions[userId] || {};
          templateOrderMap[userId] = Object.keys(userTemplates);
        });
        setTemplateOrder(templateOrderMap);
      }
    } catch (error) {
      console.error("Error saving permissions:", error);
      toast.error("Failed to save permissions");
    } finally {
      setSaving(false);
    }
  };

  const getSelectedTemplatesForUser = (userId) => {
    const userTemplates = permissionsData[userId] || {};
    return Object.keys(userTemplates);
  };

  const getTemplateName = (templateId) => {
    if (loadingTemplates || templates.length === 0) {
      return templateId;
    }
    const template = templates.find(t => t.id === templateId);
    if (!template) return templateId;
    return template.version
      ? `${template.template_name} (${template.version})`
      : template.template_name;
  };

  // Build table rows
  const buildTableRows = () => {
    const rows = [];

    // Add rows for existing users
    userIds.forEach((userId) => {
      const userTemplates = permissionsData[userId] || {};
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
          permissions: userTemplates[templateId],
        });
      });

      // Add dropdown row
      rows.push({
        type: "dropdown",
        userId,
        isFirstRow: templateIds.length === 0,
        rowSpan: totalRows,
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
          <h1>User Permissions</h1>
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
        <h1>User Permissions</h1>
      </div>

      <div className="permissions-content">
        <div className="table-container">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="col-user-id">User ID</TableHead>
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
                        <div className="user-id-input-container">
                          <input
                            type="number"
                            placeholder="Enter user ID..."
                            value={newUserId}
                            onChange={(e) => setNewUserId(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === "Enter") {
                                handleAddUserId();
                              }
                            }}
                            className="user-id-input"
                          />
                          <button
                            onClick={handleAddUserId}
                            className="add-user-button-inline"
                            disabled={!newUserId || newUserId.trim() === ""}
                          >
                            Add User
                          </button>
                        </div>
                      </TableCell>
                      <TableCell colSpan="2" className="empty-cell">
                        <span className="empty-text">Enter a user ID to start</span>
                      </TableCell>
                    </TableRow>
                  );
                } else if (row.type === "template") {
                  return (
                    <TableRow key={`${row.userId}-${row.templateId}`}>
                      {row.isFirstRow && (
                        <TableCell rowSpan={row.rowSpan} className="user-id-cell">
                          <div className="user-id-display-container">
                            <span className="user-id-number">{row.userId}</span>
                            <button
                              className="remove-user-btn"
                              onClick={() => handleRemoveUser(row.userId)}
                              title="Remove user"
                            >
                              ×
                            </button>
                          </div>
                        </TableCell>
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
                        <TableCell rowSpan={row.rowSpan} className="user-id-cell">
                          <div className="user-id-display-container">
                            <span className="user-id-number">{row.userId}</span>
                            <button
                              className="remove-user-btn"
                              onClick={() => handleRemoveUser(row.userId)}
                              title="Remove user"
                            >
                              ×
                            </button>
                          </div>
                        </TableCell>
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
                  <TableCell colSpan="3" className="empty-cell">
                    <span className="empty-text">No users added yet. Enter a user ID to start.</span>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="permissions-footer">
        <button onClick={handleSubmit} className="submit-button" disabled={saving}>
          {saving ? "Saving..." : "Submit"}
        </button>
      </div>
    </div>
  );
}

export default Permissions;
