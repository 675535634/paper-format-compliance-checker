import { useEffect, useState } from 'react';
import { Table, Card, Button, Space, Tag, Popconfirm, message, Typography } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined } from '@ant-design/icons';
import { api } from '../../api';
import type { RuleTemplate } from '../../types';
import { useNavigate } from 'react-router-dom';

const { Paragraph } = Typography;

const TemplatesManage: React.FC = () => {
  const [templates, setTemplates] = useState<RuleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const data = await api.getTemplates();
      setTemplates(data);
    } catch {
      message.error('获取模板失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTemplates();
  }, []);

  const withTemplateAction = async (templateId: string, action: () => Promise<void>) => {
    setActiveTemplateId(templateId);
    try {
      await action();
    } finally {
      setActiveTemplateId(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteTemplate(id);
      message.success('模板已删除');
      await fetchTemplates();
    } catch {
      message.error('删除模板失败');
    }
  };

  const handleCopy = async (id: string) => {
    try {
      await api.copyTemplate(id);
      message.success('模板已复制');
      await fetchTemplates();
    } catch {
      message.error('复制模板失败');
    }
  };

  const handleApply = async (id: string) => {
    try {
      await api.applyTemplate(id);
      message.success('已设为默认模板，并跳转到检测页');
      await fetchTemplates();
      navigate(`/check?templateId=${encodeURIComponent(id)}`);
    } catch {
      message.error('应用模板失败');
    }
  };

  const columns = [
    {
      title: '模板名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: RuleTemplate) => (
        <Space>
          <span style={{ fontWeight: 500 }}>{text}</span>
          {record.isDefault && <Tag color="blue">默认</Tag>}
        </Space>
      ),
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'description',
      render: (text: string) => text || '-',
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (value: string) => value.replace('T', ' ').slice(0, 19),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: RuleTemplate) => (
        <Space size="middle">
          <Button
            type="link"
            size="small"
            loading={activeTemplateId === record.id}
            onClick={() => void withTemplateAction(record.id, () => handleApply(record.id))}
          >
            应用
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => navigate(`/rules?templateId=${encodeURIComponent(record.id)}`)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={<CopyOutlined />}
            loading={activeTemplateId === record.id}
            onClick={() => void withTemplateAction(record.id, () => handleCopy(record.id))}
          >
            复制
          </Button>
          {!record.isDefault && (
            <Popconfirm
              title="确定要删除这个模板吗？"
              okText="删除"
              cancelText="取消"
              onConfirm={() => void withTemplateAction(record.id, () => handleDelete(record.id))}
            >
              <Button type="link" danger size="small" icon={<DeleteOutlined />} loading={activeTemplateId === record.id}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        variant="borderless"
        title={<span style={{ fontSize: 20 }}>模板管理</span>}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/rules')}>
            新建模板
          </Button>
        }
      >
        <Paragraph type="secondary" style={{ marginTop: -4 }}>
          可以在这里维护学校模板、专业模板或个人常用模板，并将其中一个模板设为默认检测规则。
        </Paragraph>

        <Table
          columns={columns}
          dataSource={templates}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>
    </div>
  );
};

export default TemplatesManage;
